# Prompts de extração

Estes são os contratos públicos usados para converter uma imagem ou descrição em um JSON aceito pela Central JSON:

```text
Imagem/descrição
→ prompt específico
→ modelo multimodal
→ JSON puro
→ Central JSON
→ validação local
→ Supabase com RLS
```

- [Alimentação](food-image-reader.md)
- [Sono](sleep-image-reader.md)
- [Cardio](cardio-image-reader.md)
- [Força medida pelo wearable](strength-wearable-image-reader.md)

Não existe um prompt `master/common` separado para esses leitores. As regras compartilhadas são: retornar apenas JSON, não inventar dados, manter ausências como `null`, usar exemplos sintéticos e nunca incluir identificadores ou credenciais. A Central JSON rejeita chaves perigosas, datas inválidas, números fora de faixas razoáveis e estruturas excessivas antes de persistir os campos permitidos.

O fluxo por prompt complementa, mas não substitui, a sincronização automática:

```text
Redmi Watch → Mi Fitness → Health Connect → Android → Supabase
```

Dados fisiológicos do wearable são estimativas. Kcal, passos e frequência cardíaca de uma sessão podem já existir no Health Connect e não devem ser somados novamente.
