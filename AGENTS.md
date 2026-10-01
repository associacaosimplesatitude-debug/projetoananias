# Architecture Rules

- Keep the prioritized primary role for login redirects, but derive UI permissions from the complete `user_roles` set so multi-role access is additive.