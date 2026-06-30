from slowapi import Limiter
from slowapi.util import get_remote_address

# Generous default for the whole API; auth routes layer a tighter limit on top via
# @limiter.limit(...) since login is the most brute-force-sensitive endpoint.
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
