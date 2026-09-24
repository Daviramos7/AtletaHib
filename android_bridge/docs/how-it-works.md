# Como a ponte funciona

Fluxo:

```txt
Redmi Watch 5 Active
→ Mi Fitness
→ Health Connect
→ Atleta Híbrido Bridge Android
→ Supabase
→ Atleta Híbrido Cloud Web/PWA
```

O app Android não fala diretamente com o relógio Xiaomi. Ele lê os dados que o Mi Fitness conseguir gravar no Health Connect.

## Dados lidos na v4.1.3

- passos do dia
- sono em minutos
- frequência cardíaca média
- frequência cardíaca de repouso
- calorias ativas
- minutos de treino
- distância em km

## Limites reais

1. Se o Mi Fitness não enviar um dado ao Health Connect, a ponte não consegue inventar esse dado.
2. O app web/PWA não consegue ler Health Connect diretamente; por isso existe este app Android.
3. A sincronização é manual: Hoje ou últimos 7 dias. Não existe fila offline ou tarefa automática em background.
4. A chave `service_role` do Supabase nunca deve ser colocada no APK.

## Leitura e contrato

`HealthConnectReader` adapta o SDK; `DailyReader` diferencia dado disponível, ausente, sem permissão e falha. Cada leitura paginada esgota `pageToken`; erro numa página não transforma leitura incompleta em sucesso. Cancelamento é propagado.

Para HR, são usadas todas as origens, sem whitelist de pacote Mi Fitness. Cada amostra deve estar no intervalo do dia local `[00:00, 00:00 do próximo dia)` e ter BPM válido. A chave de dedupe é origem + timestamp preciso + BPM, sem agrupar artificialmente por minuto. A média de todas as amostras válidas é arredondada uma vez para o inteiro aceito pelo backend. Não são persistidas amostras individuais.

RHR usa somente registros reais `RestingHeartRateRecord`. O app não tenta recuperar estimativas históricas nem inferir ausência como zero. Sono usa a janela noturna existente; passos usam agregação Health Connect. Duração de atividades une intervalos sobrepostos, respeita os limites do dia e preserva execução acima de 20 minutos. Distância e calorias selecionam o maior total por origem para não somar fontes sobrepostas.

`SyncCoordinator` impede execuções concorrentes. `SupabaseRestClient` consulta o resumo de `(user_id, metric_date, source)`; se igual, não escreve; se alterado, atualiza os campos conhecidos; se novo, faz upsert com conflito nessa chave. `source=health_connect_android_bridge` e `provider=health_connect` são explícitos, inclusive na serialização. Os valores devolvidos pelo servidor precisam confirmar a gravação. Dados ausentes não sobrescrevem métricas já existentes.

## Autenticação e segurança

O token de acesso é usado com a chave pública; RLS do Supabase continua sendo a fronteira de acesso. Credenciais locais são cifradas por AES-GCM com chave do Android Keystore. Uma sessão antiga em texto é convertida no primeiro carregamento; falha da chave exige novo login, sem fallback em texto.

Logout explícito chama `POST /auth/v1/logout?scope=global`. Em sucesso, limpa a sessão local. Uma resposta 401 permite uma única renovação e tentativa; refresh revogado ou segundo 401 limpa a sessão, sem loop. Offline não confirma revogação nem remove a sessão como se tivesse sido concluída. Os demais dispositivos reconhecem a revogação quando renovam/validam a sessão; JWTs já emitidos podem continuar válidos até expirar.

Referências: [Supabase sign-out](https://supabase.com/docs/guides/auth/signout), [leitura Health Connect](https://developer.android.com/health-and-fitness/health-connect/read-data).

## Validação no dispositivo

Os testes locais usam dados sintéticos e não substituem Health Connect real. No celular, conferir permissões, contagem de registros/amostras, envio da média e uma segunda sincronização sem duplicar. O diagnóstico não deve publicar tokens, payloads de saúde ou identificadores pessoais.
