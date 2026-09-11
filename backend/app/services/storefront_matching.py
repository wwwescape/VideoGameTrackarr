"""Matches a wishlisted LibraryItem's own digital_storefront (e.g. "Steam", set via the
Library dialog's dropdown — see DIGITAL_STOREFRONT_PLATFORM_SLUGS in
LibraryItemDialog.tsx) against the shop-specific deals IsThereAnyDeal returns for the same
game, so a row only ever surfaces the price for the shop it's actually tracked against — not
whichever shop happens to be globally cheapest right now. That was the original bug: a Steam
wishlist row showed an Epic Games Store discount purely because Epic's price was lower.
"""

from app.models.itad import ItadPriceCache
from app.services.itad_client import ItadDeal

# ITAD's shop names don't always match this app's dropdown labels verbatim (e.g. ITAD says
# "Epic Game Store", the dropdown says "Epic Games Store") — normalized aliases bridge the
# gap for every storefront option the dropdown offers (see DIGITAL_STOREFRONT_PLATFORM_SLUGS
# in LibraryItemDialog.tsx). A storefront not listed here (free text via freeSolo) still
# works through the exact-match fallback in shop_matches_storefront.
_STOREFRONT_ITAD_SHOP_ALIASES: dict[str, set[str]] = {
    "steam": {"steam"},
    "gog": {"gog", "gog.com"},
    "epic games store": {"epic games store", "epic game store"},
    "ubisoft connect": {"ubisoft connect", "ubisoft store", "uplay"},
    "ea app": {"ea app", "origin", "ea store"},
    "battle.net": {"battle.net", "blizzard battle.net"},
    "microsoft store": {"microsoft store", "xbox store", "xbox"},
    "itch.io": {"itch.io"},
}


def _normalize(name: str) -> str:
    return " ".join(name.strip().lower().split())


def shop_matches_storefront(shop_name: str, storefront: str) -> bool:
    normalized_shop = _normalize(shop_name)
    normalized_storefront = _normalize(storefront)
    aliases = _STOREFRONT_ITAD_SHOP_ALIASES.get(normalized_storefront)
    if aliases is not None:
        return normalized_shop in aliases
    return normalized_shop == normalized_storefront


def find_deal(cache: ItadPriceCache, storefront: str | None) -> ItadDeal | None:
    """Picks whichever of ITAD's currently-reported deals actually applies to a row tracking
    `storefront`. When the row names a specific storefront and cache.deals (every shop ITAD
    returned as of the last refresh) has a matching shop, that shop's price wins. Returns None
    when a storefront is named but none of the known current deals match it — that's a real
    "not on sale for you" case, not a fallback opportunity.

    Falls back to the cache's own aggregate current_* fields (the overall-cheapest deal) only
    when there's no storefront to match against, or `deals` hasn't been populated yet (a cache
    row from before this per-shop matching existed, refreshed again on the next scheduled
    itad_refresh run)."""
    if storefront and cache.deals:
        for entry in cache.deals:
            if shop_matches_storefront(entry["shop_name"], storefront):
                return ItadDeal(
                    shop_name=entry["shop_name"],
                    price_amount=entry["price_amount"],
                    price_currency=entry["price_currency"],
                    cut=entry["cut"],
                )
        return None
    if cache.current_price_amount is None:
        return None
    return ItadDeal(
        shop_name=cache.current_shop_name,
        price_amount=cache.current_price_amount,
        price_currency=cache.current_price_currency,
        cut=cache.current_cut or 0,
    )
