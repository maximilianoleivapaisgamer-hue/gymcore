# IA: Entrenador y Nutricionista

GymCore ahora puede **generar rutinas y planes de comidas con IA** (Claude) y
asignarlos automáticamente a un socio.

## Cómo se usa (en el panel)

- **Rutinas** → botón **✨ Generar con IA**. Elegís el socio, el objetivo, el
  nivel, los días por semana y el equipamiento. La IA arma la rutina completa
  (días → bloques → ejercicios con series/reps/notas), crea en la biblioteca los
  ejercicios que falten y la deja **asignada al socio**.
- **Dietas** (plan Elite) → botón **✨ Generar con IA**. Elegís el socio, el
  objetivo, las comidas por día, los días y las restricciones (vegetariano, sin
  TACC, etc.). La IA arma el plan con recetas y lo asigna al socio.

El flujo es **automático**: al confirmar, genera **y guarda**. Después podés
abrir la rutina/dieta y editarla como cualquier otra.

## Variables de entorno (Vercel → Project Settings → Environment Variables)

| Variable | Obligatoria | Para qué |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Sí** | Clave de la API de Claude (https://console.anthropic.com). Se paga por uso. |
| `ANTHROPIC_MODEL` | No | Id del modelo. Por defecto `claude-3-5-sonnet-latest`. Cambialo si querés uno más nuevo/económico. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí** | Ya la usás para el alta de socios. Permite guardar la rutina/dieta del lado del servidor. |

> La `ANTHROPIC_API_KEY` **nunca** se expone al navegador: solo la usan las rutas
> de servidor `app/api/ai/rutina` y `app/api/ai/dieta`.

## Dónde se "entrena" la IA (las skills)

El criterio de cada IA vive en archivos de texto que podemos afinar juntos, sin
tocar el resto del código:

- `lib/ai/skills/entrenador.ts` → cómo arma las rutinas (splits, volumen,
  series/reps por objetivo, seguridad ante lesiones, tono).
- `lib/ai/skills/nutricionista.ts` → cómo arma los planes (objetivos, recetas
  simples, restricciones, aclaración de que no reemplaza a un profesional).

Para cambiar el comportamiento: editás el texto dentro de esos archivos (sumás
reglas, ejemplos, restricciones) y listo. **No cambies** la sección "FORMATO DE
SALIDA" de cada skill: es la que hace que los datos encajen en el panel.

## Archivos nuevos

```
lib/ai/anthropic.ts              Cliente de Claude (fetch + tool-use, sin dependencias)
lib/ai/skills/entrenador.ts      Skill del entrenador (editable)
lib/ai/skills/nutricionista.ts   Skill del nutricionista (editable)
app/api/ai/rutina/route.ts       Genera y guarda la rutina
app/api/ai/dieta/route.ts        Genera y guarda el plan de comidas
components/AiGenerate.tsx         Botón + modal reutilizable
```

Y se agregó el botón **✨ Generar con IA** en `app/dashboard/rutinas/page.tsx` y
`app/dashboard/dietas/page.tsx`.

## Costo (importante)

Cada generación es una llamada a la API de Claude y tiene un costo por tokens
(lo cobra Anthropic a tu cuenta, según el modelo elegido). Una rutina o un plan
de comidas ronda unos pocos miles de tokens. Podés bajar el costo usando un
modelo más económico en `ANTHROPIC_MODEL`.
