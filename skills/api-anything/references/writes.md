# Writes and state-modifying operations

A write operation modifies server state (post, comment, message, vote, purchase, or delete).

## Safety Rules

1. **Explicit Permission Required**: Never execute a write operation unless the user has explicitly requested that specific action with the exact payload provided.
2. **Idempotency**: Use idempotency keys where supported by the target API.
3. **Readback Verification**: Verify that the write succeeded by executing a subsequent read operation when possible:
```bash
npx -y api-anything readback <site> <write-op> <read-op> key=val --find field=value
```
4. **Authentication Boundary**: Writes requiring credentials use the local session stored in `~/.api-anything/`. Never transmit user passwords, API keys, or session tokens into LLM prompts or chat logs.
