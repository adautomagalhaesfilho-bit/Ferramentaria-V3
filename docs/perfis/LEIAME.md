# Perfis de empresa

Cada empresa que usa o produto tem **um perfil**: o conjunto de valores e de regras específicas dela. Fica aqui, fora de `docs/REGRAS.md`, porque `REGRAS.md` descreve só o que vale para qualquer empresa.

Cada perfil contém:
1. **Valores dos parâmetros** (turnos, capacidade, refeição, setores, isentos, ciclo...), na ordem do `REGRAS.md`.
2. **Regras específicas**: particularidades da empresa, sempre escritas como parâmetro com data de início, nunca como código.
3. **Casos de aceite**: dias reais ou exemplos com números, que provam que a configuração da empresa dá o resultado que ela espera. Viram testes do perfil.
4. **Pendências** daquela empresa.

Para entrar uma empresa nova: copiar `modelo.md`, preencher com a empresa, configurar na tela e rodar os casos de aceite.
