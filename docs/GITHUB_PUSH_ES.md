# Subir el proyecto a GitHub

## Opción A — Con GitHub CLI

```bash
gh auth login --web --git-protocol https
gh repo create browser-clicker-agent --private --source=. --remote=origin
git add .
git commit -m "Create browser clicker agent scaffold"
git branch -M main
git push -u origin main
```

Después crear ramas:

```bash
bash scripts/create-branches.sh
```

## Opción B — Sin GitHub CLI

1. Crear repo vacío en GitHub llamado:

```text
browser-clicker-agent
```

2. En terminal dentro de la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Create browser clicker agent scaffold"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/browser-clicker-agent.git
git push -u origin main
```

3. Crear ramas:

```bash
bash scripts/create-branches.sh
```

## Reparto después del push

Miguel:

```bash
git checkout feature/miguel-ui-extension
```

Socio:

```bash
git checkout feature/agent-planner-api
```
