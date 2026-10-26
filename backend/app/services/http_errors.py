import httpx


def raise_for_status_redacted(response: httpx.Response) -> None:
    """response.raise_for_status(), but the error's message names only the host and path.

    httpx's own message includes the full URL, query string and all, and Steam and
    IsThereAnyDeal take their API key as a `key=` query parameter — so the stock message
    would carry the key into job results, the UI and logs (anything that keeps `str(exc)`).
    The request and response stay attached for callers that check the status code.
    """
    if response.is_success:
        return
    request = response.request
    target = f"{request.url.host}{request.url.path}"
    message = f"{request.method} {target} returned {response.status_code} {response.reason_phrase}"
    raise httpx.HTTPStatusError(message.strip(), request=request, response=response)
