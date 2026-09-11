from app.models.itad import ItadPriceCache
from app.services import storefront_matching


def _cache(**kwargs) -> ItadPriceCache:
    return ItadPriceCache(game_id=1, **kwargs)


def test_shop_matches_storefront_handles_itads_epic_naming_mismatch():
    # The app's dropdown says "Epic Games Store"; ITAD's own shop name is "Epic Game Store"
    # (no "s") — a naive exact-string comparison would never match either spelling.
    assert storefront_matching.shop_matches_storefront("Epic Game Store", "Epic Games Store") is True


def test_shop_matches_storefront_is_case_and_whitespace_insensitive():
    assert storefront_matching.shop_matches_storefront("  steam ", "Steam") is True


def test_shop_matches_storefront_falls_back_to_exact_match_for_unknown_storefronts():
    assert storefront_matching.shop_matches_storefront("Green Man Gaming", "Green Man Gaming") is True
    assert storefront_matching.shop_matches_storefront("Fanatical", "Green Man Gaming") is False


def test_find_deal_picks_the_matching_shop_not_the_cheapest():
    cache = _cache(
        current_price_amount=8.0,
        current_shop_name="Epic Games Store",
        current_cut=60,
        deals=[
            {"shop_name": "Steam", "price_amount": 12.0, "price_currency": "USD", "cut": 40},
            {"shop_name": "Epic Game Store", "price_amount": 8.0, "price_currency": "USD", "cut": 60},
        ],
    )

    deal = storefront_matching.find_deal(cache, "Steam")

    assert deal is not None
    assert deal.shop_name == "Steam"
    assert deal.price_amount == 12.0
    assert deal.cut == 40


def test_find_deal_returns_none_when_the_storefront_has_no_current_deal():
    cache = _cache(
        current_price_amount=8.0,
        current_shop_name="Epic Games Store",
        current_cut=60,
        deals=[{"shop_name": "Epic Game Store", "price_amount": 8.0, "price_currency": "USD", "cut": 60}],
    )

    assert storefront_matching.find_deal(cache, "Steam") is None


def test_find_deal_falls_back_to_aggregate_fields_when_storefront_is_unset():
    cache = _cache(
        current_price_amount=8.0,
        current_price_currency="USD",
        current_shop_name="Epic Games Store",
        current_cut=60,
        deals=[
            {"shop_name": "Steam", "price_amount": 12.0, "price_currency": "USD", "cut": 40},
            {"shop_name": "Epic Game Store", "price_amount": 8.0, "price_currency": "USD", "cut": 60},
        ],
    )

    deal = storefront_matching.find_deal(cache, None)

    assert deal is not None
    assert deal.shop_name == "Epic Games Store"
    assert deal.price_amount == 8.0


def test_find_deal_falls_back_to_aggregate_fields_when_deals_not_populated_yet():
    # A cache row refreshed before this per-shop matching existed (or a test fixture that
    # only sets the aggregate current_* fields) has deals=None — must not be treated the
    # same as "we checked and none of the current deals match."
    cache = _cache(current_price_amount=14.99, current_shop_name="GOG", current_cut=40)

    deal = storefront_matching.find_deal(cache, "Steam")

    assert deal is not None
    assert deal.shop_name == "GOG"


def test_find_deal_returns_none_when_nothing_is_on_sale():
    cache = _cache(current_price_amount=None)

    assert storefront_matching.find_deal(cache, "Steam") is None
