# Auditoria de fechamento — Atleta Hib v4.1.0

Gerado em: 2026-07-08 20:51:31

## Resumo automático

| Status | Quantidade |
|---|---:|
| PASS | 42 |
| WARN | 8 |
| FAIL | 0 |

## Resultado automático

| Categoria | Checagem | Status | Detalhes | Evidência |
|---|---|---|---|---|
| Build | npm run typecheck | PASS | Comando executado com sucesso. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\02_typecheck.log |
| Build | npm run build | PASS | Comando executado com sucesso. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\03_build.log |
| Arquitetura | dates.ts existe | PASS | Arquivo encontrado. | src\utils\dates.ts |
| Arquitetura | durations.ts existe | PASS | Arquivo encontrado. | src\utils\durations.ts |
| Supabase | migration v4.1.0 existe | PASS | Arquivo encontrado. | database\migrations\2026_07_08_data_integrity_v410.sql |
| Componentes | ImportJsonView existe | PASS | Arquivo encontrado. | src\components\ImportJsonView.tsx |
| Componentes | GymModeView existe | PASS | Arquivo encontrado. | src\components\GymModeView.tsx |
| Componentes | CardioDataHistoryView existe | PASS | Arquivo encontrado. | src\components\CardioDataHistoryView.tsx |
| Componentes | DietView existe | PASS | Arquivo encontrado. | src\components\DietView.tsx |
| Componentes | Dashboard existe | PASS | Arquivo encontrado. | src\components\Dashboard.tsx |
| Services | cardioService existe | PASS | Arquivo encontrado. | src\services\cardioService.ts |
| Services | mealService existe | PASS | Arquivo encontrado. | src\services\mealService.ts |
| Services | sleepService existe | PASS | Arquivo encontrado. | src\services\sleepService.ts |
| Services | workoutService existe | PASS | Arquivo encontrado. | src\services\workoutService.ts |
| Services | wearableService existe | PASS | Arquivo encontrado. | src\services\wearableService.ts |
| Services | strengthWearableService existe | PASS | Arquivo encontrado. | src\services\strengthWearableService.ts |
| Services | checkinService existe | PASS | Arquivo encontrado. | src\services\checkinService.ts |
| Services | analyticsService existe | PASS | Arquivo encontrado. | src\services\analyticsService.ts |
| Datas | cardioService usa dates.ts | PASS | Padrão encontrado. | src\services\cardioService.ts |
| Datas | sleepService usa dates.ts | PASS | Padrão encontrado. | src\services\sleepService.ts |
| Duração | cardioService usa durations.ts | PASS | Padrão encontrado. | src\services\cardioService.ts |
| Duração | strengthWearableService usa durations.ts | PASS | Padrão encontrado. | src\services\strengthWearableService.ts |
| JSON | ImportJsonView considera training_effect | PASS | Padrão encontrado. | src\components\ImportJsonView.tsx |
| JSON | ImportJsonView considera distance_km | PASS | Padrão encontrado. | src\components\ImportJsonView.tsx |
| JSON | ImportJsonView considera duration_minutes | PASS | Padrão encontrado. | src\components\ImportJsonView.tsx |
| Comida | mealService tem proteção de duplicidade | WARN | Padrão não encontrado: duplicate | src\services\mealService.ts |
| Comida | mealService exige data explícita | PASS | Padrão encontrado. | src\services\mealService.ts |
| Cardio | cardioService usa dedupe_key | PASS | Padrão encontrado. | src\services\cardioService.ts |
| Treino | workoutService tem rollback/delete em falha | PASS | Padrão encontrado. | src\services\workoutService.ts |
| Supabase | Migration tem wearable_daily_metrics | PASS | Padrão encontrado. | database\migrations\2026_07_08_data_integrity_v410.sql |
| Supabase | Migration tem user_id, metric_date, source | PASS | Padrão encontrado. | database\migrations\2026_07_08_data_integrity_v410.sql |
| Android | Android Bridge usa on_conflict com source | PASS | Padrão encontrado. | android_bridge\app\src\main\java\com\daviramos\atletabridge\data\SupabaseRestClient.kt |
| Data/Hora | Uso de toISOString().slice | WARN | Foram encontrados 2 pontos. Revisar log. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Uso_de_toISOString___slice.txt |
| Data/Hora | Uso de new Date().toISOString | WARN | Foram encontrados 6 pontos. Revisar log. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Uso_de_new_Date___toISOString.txt |
| Nulos | Uso de \/\/ 0 | WARN | Foram encontrados 108 pontos. Revisar log. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Uso_de____0.txt |
| Nulos | Uso de ?? 0 | WARN | Foram encontrados 47 pontos. Revisar log. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Uso_de____0.txt |
| Supabase | Uso de maybeSingle | WARN | Foram encontrados 7 pontos. Revisar log. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Uso_de_maybeSingle.txt |
| Cardio legado | Uso de run_sessions | WARN | Foram encontrados 13 pontos. Revisar log. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Uso_de_run_sessions.txt |
| Cardio novo | Uso de cardio_sessions | PASS | Foram encontrados 24 pontos. Revisar log. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Uso_de_cardio_sessions.txt |
| JSON | Uso de training_effect | PASS | Foram encontrados 7 pontos. Revisar log. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Uso_de_training_effect.txt |
| Dedupe | Uso de dedupe_key | PASS | Foram encontrados 20 pontos. Revisar log. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Uso_de_dedupe_key.txt |
| Saúde/UX | Texto agressivo: aumente cardio | PASS | Nenhuma ocorrência encontrada. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Texto_agressivo__aumente_cardio.txt |
| Saúde/UX | Texto agressivo: coma menos | PASS | Nenhuma ocorrência encontrada. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Texto_agressivo__coma_menos.txt |
| Saúde/UX | Texto de diagnóstico | WARN | Foram encontrados 10 pontos. Revisar log. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\Texto_de_diagn_stico.txt |
| Segurança | Arquivos sensíveis rastreados pelo Git | PASS | Nenhum arquivo sensível rastreado. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\tracked_sensitive_files.txt |
| Gitignore | .gitignore ignora .env.local | PASS | Padrão encontrado. | .gitignore |
| Gitignore | .gitignore ignora local.properties | PASS | Padrão encontrado. | .gitignore |
| Gitignore | .gitignore ignora gradle.properties | PASS | Padrão encontrado. | .gitignore |
| Gitignore | .gitignore ignora tsbuildinfo | PASS | Padrão encontrado. | .gitignore |
| Payloads | JSONs de teste criados | PASS | Foram criados 8 payloads de teste. | C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib\docs\audits\v4.1.0\logs\payloads_created.txt |

## Matriz de validação dos riscos originais

| ID | Categoria | Risco original | Status manual | Evidência | Teste feito | Resultado | Próximo ajuste |
|---|---|---|---|---|---|---|---|
| 1 | JSON/Cardio | JSON de cardio com training_effect cair como força |  |  |  |  |  |
| 2 | Comida | Reimportar comida duplicar kcal |  |  |  |  |  |
| 3 | Comida | Alimento manual sem kcal virar 0 kcal |  |  |  |  |  |
| 4 | Wearable | Android Bridge e Supabase discordarem sobre chave única |  |  |  |  |  |
| 5 | Treino | Finalizar treino com cardio >20 min salvar força parcialmente |  |  |  |  |  |
| 6 | Data/Hora | Treino cruzando meia-noite cair em dias diferentes |  |  |  |  |  |
| 7 | Data/Hora | toISOString/slice mudar data local |  |  |  |  |  |
| 8 | Cardio | Dedupe sobrescrever duas sessões reais iguais |  |  |  |  |  |
| 9 | JSON/Comida | JSON sem date cair em hoje |  |  |  |  |  |
| 10 | JSON/Duração | duration: 20 ser interpretado como 20 segundos |  |  |  |  |  |
| 11 | Wearable | maybeSingle falhar com múltiplas fontes |  |  |  |  |  |
| 12 | Relatório | run_sessions + cardio_sessions dupla contagem |  |  |  |  |  |
| 13 | Check-in | Nota da manhã ser sobrescrita pelo fechamento |  |  |  |  |  |
| 14 | Peso | Relatório dizer "na janela" usando peso fora da janela |  |  |  |  |  |
| 15 | Saúde/UX | Kcal muito baixa receber feedback positivo |  |  |  |  |  |
| 16 | Força | Workout session salva sem séries em falha parcial |  |  |  |  |  |
| 17 | Segurança | .env/local.properties/gradle.properties no pacote |  |  |  |  |  |
| 18 | Cardio | 20:08 aparecer como 20 min |  |  |  |  |  |
| 19 | Check-in | Readiness tratar dado ausente como 0 confiável |  |  |  |  |  |
| 20 | Comida | Macro ausente aparecer como 0g real |  |  |  |  |  |
| 21 | Cardio | Cardio sem distância aparecer como 0.00 km |  |  |  |  |  |
| 22 | Corrida | "Melhor 1 km" ser apenas pace médio |  |  |  |  |  |
| 23 | Cardio | JSON antigo avançar progressão do plano |  |  |  |  |  |
| 24 | Sono | Sono cruzando meia-noite cair no dia errado |  |  |  |  |  |
| 25 | Água | Cliques rápidos perderem incremento |  |  |  |  |  |

## Testes manuais obrigatórios

Use os JSONs gerados em:

docs/audits/v4.1.0/test_payloads

### 1. JSON cardio hoje com training_effect

Arquivo:

 1_cardio_hoje_com_training_effect.json

Resultado esperado:

- Deve salvar como cardio.
- Não deve salvar como força do relógio.
- Deve aparecer em histórico de cardio.

### 2. JSON cardio antigo

Arquivo:

 2_cardio_antigo.json

Resultado esperado:

- Deve alertar que a data é diferente de hoje.
- Deve salvar no dia antigo.
- Não deve aparecer como treino de hoje.

### 3. JSON comida sem date

Arquivo:

 3_comida_sem_date_deve_bloquear.json

Resultado esperado:

- Deve bloquear.
- Não pode salvar automaticamente em hoje.

### 4. Comida duplicada

Arquivo:

 4_comida_duplicada_teste.json

Resultado esperado:

- Primeira importação salva.
- Segunda importação deve bloquear ou avisar duplicidade.
- Total calórico não pode dobrar.

### 5. Cardio 20:08

Arquivo:

 5_cardio_20min08s.json

Resultado esperado:

- Deve exibir 20:08 ou equivalente.
- Não deve mascarar como 20 min seco.

### 6. Cardio com duration ambíguo

Arquivo:

 6_cardio_duration_ambiguo_deve_bloquear.json

Resultado esperado:

- Deve bloquear ou pedir unidade.
- Não deve interpretar como 20 segundos.

### 7. Comida com macro ausente

Arquivo:

 7_comida_macro_ausente.json

Resultado esperado:

- Kcal deve aparecer.
- Macro ausente não deve ser tratada visualmente como certeza de 0g, se a tela tiver distinção.

### 8. Sono cruzando meia-noite

Arquivo:

 8_sono_cruzando_meia_noite.json

Resultado esperado:

- Deve salvar no dia correto conforme regra definida.
- Se a regra ainda estiver ambígua, marcar como pendência.

### 9. Cardio manual sem distância

Teste pela UI.

Resultado esperado:

- Deve mostrar "sem distância".
- Não deve mostrar 0.00 km.

### 10. Dieta manual sem kcal/100g

Teste pela UI.

Resultado esperado:

- Deve bloquear.
- Não pode salvar alimento com 0 kcal por campo vazio.

### 11. Treino força + cardio acima de 20 min recusado

Teste pela UI.

Resultado esperado:

- Se recusar o cardio, não deve salvar força parcialmente.
- Não deve duplicar treino.

### 12. Relatório semanal

Depois dos testes, abrir relatório semanal.

Resultado esperado:

- Não deve contar cardio duplicado.
- Não deve somar kcal de sessão importada como total diário sem regra explícita.
- Não deve misturar força do relógio com força do app sem distinção.

## Interpretação

- PASS: passou na checagem automática.
- WARN: precisa de revisão humana. Nem todo WARN é bug.
- FAIL: precisa corrigir antes de considerar a v4.1.0 fechada.

## Critério para liberar v4.1.0

- 
pm run typecheck precisa passar.
- 
pm run build precisa passar.
- Nenhum FAIL de segurança/migration.
- Testes manuais de JSON, comida, cardio e treino precisam passar.
- Relatório semanal não pode duplicar cardio/comida.
