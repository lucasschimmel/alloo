# Shared frontend build configuration

The explicit @alloo/config/vite export owns Vite plugins and Worker build safety defaults. Applications supply their environment directory and port. This package is a development dependency of each app and must never be imported into application runtime code.
