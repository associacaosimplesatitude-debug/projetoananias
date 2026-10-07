# Architecture Rules

- Keep the prioritized primary role for login redirects, but derive UI permissions from the complete `user_roles` set so multi-role access is additive.
- Keep financial approval, invoiced proposal history, and confirmed orders in separate tabs; reuse AdminPedidosTab for confirmed orders so channel filters and existing actions remain consistent.