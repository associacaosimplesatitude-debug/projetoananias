

## Plano: Restringir Revistas Digitais apenas para Admin

### Situação atual
- O **menu** já está oculto para `gerente_ebd` e `financeiro` (linhas 371 e 376 do `AdminEBDLayout.tsx`)
- Porém a **rota** `/admin/ebd/revistas-digitais` ainda é acessível diretamente por qualquer role com acesso ao `/admin/ebd` (gerente_ebd, financeiro)

### Alteração
**`src/App.tsx`** — Envolver as rotas `revistas-digitais` e `revistas-assinaturas` com um `ProtectedRoute` que exige `requireAdmin` **sem** `allowGerenteEbd` ou `allowFinanceiro`:

```tsx
<Route path="revistas-digitais" element={
  <ProtectedRoute requireAdmin>
    <RevistasDigitais />
  </ProtectedRoute>
} />
<Route path="revistas-assinaturas" element={
  <ProtectedRoute requireAdmin>
    <RevistasAssinaturas />
  </ProtectedRoute>
} />
```

Isso garante que mesmo acessando a URL diretamente, apenas o admin geral consegue visualizar a página.

