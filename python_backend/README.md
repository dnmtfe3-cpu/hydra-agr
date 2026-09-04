# backend python

esta pasta inicia a migração gradual do backend do hydra agro para python.

o frontend continua em react + typescript. isso evita reescrever as telas e o aplicativo android sem necessidade.

## stack

- python
- fastapi
- pydantic
- supabase

## executar localmente

```bash
cd python_backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

no windows, ative o ambiente com `.venv\Scripts\activate`.

## rotas iniciais

- `get /` — informações da api
- `get /health` — verificação de saúde

## próximos passos

as funções de backend devem ser migradas aos poucos. autenticação e autorização precisam continuar sendo validadas no servidor e no supabase. chaves administrativas nunca devem ser colocadas no frontend.
