# Bitácora del sistema Zentec

## Estado actual

Panel en producción en panel.zentec.solutions, actualizado el 7 de septiembre
de 2026. Siete pantallas funcionando con datos reales: tablero, prospectos,
conversaciones, cotizaciones, clientes, productos, órdenes, facturas y
configuración. Login con Supabase Auth, sesión persistente.

El rol de usuario se lee de la tabla `perfiles`, no del JWT, porque los
metadatos del usuario los puede editar el propio usuario y no sirven para
autorizar. La tabla `perfiles` no existe todavía y el panel está escrito para
tolerarlo: si no existe, entra sin rol y deja que RLS decida.

Las políticas RLS son provisionales (`using (true)` para autenticados),
aceptables mientras exista un solo usuario del panel.

Tema oscuro con acento cian, densidad de tabla alta (el panel existe para ver
conjuntos, que es lo que WhatsApp hace mal). Cristal esmerilado solo en
sidebar y métricas, no sobre tablas.

Existe una landing page en `landing/` dentro del mismo repo, con piel clara,
opuesta a la del panel.

Los seis commits del repo son locales: no se ha hecho `git push`.

Se crearon tres agentes en `~/.claude/agents/`: `zentec-arquitecto` (seguridad
y arquitectura), `zentec-marketing` (publicidad digital) y `watson` (esta
bitácora).

## Decisiones tomadas

**7 de septiembre de 2026 — El panel de agenda va en un repo aparte, no como
módulo del panel de Zentec.** El panel se conecta a Supabase desde el
navegador con la publishable key, que queda visible dentro del build. Si los
dos productos compartieran build, ese build llevaría las dos llaves, y el
cliente del sistema de citas tendría en su navegador la llave del proyecto de
Zentec. Con paneles separados, cada build lleva solo la suya. Razones
secundarias: no comparten ni una pantalla, y el panel de Zentec ya está en
producción — no conviene arriesgarlo al desplegar el otro.

**7 de septiembre de 2026 — No se conecta el botón de "reenviar cotización por
WhatsApp" todavía.** Fuera de la ventana de 24 horas de Meta, la API acepta el
envío, devuelve un identificador y no entrega el mensaje. El panel diría
"enviada" y el cliente no recibiría nada: una certeza falsa sobre justo lo que
más importa. Mientras no haya plantilla aprobada, se descartó conectar el
botón y se dejó el enlace wa.me que ya existe, por ser más honesto.

**7 de septiembre de 2026 — Arena (el salón de uñas) pasó de cliente a
prueba.** Marcos decidió que no le interesa cerrarlo por ahora. Esto invalidó
una recomendación previa de priorizar el sistema de citas. La conclusión
nueva: todo lo que se construya ahora es para que Zentec opere mejor, y el
caso de éxito para vender lo va a construir la propia operación de Zentec con
sus números.

**El despliegue a producción lo autoriza Marcos, siempre.** Se propuso
autorizar la llave SSH de la Mac en el VPS para automatizarlo y se decidió que
no: nadie necesita acceso root permanente a un servidor donde corre un bot en
producción. El flujo acordado es que Claude Code compila y verifica, y Marcos
corre el rsync.

**Node no se instala con Homebrew en esta Mac.** Es Intel con macOS 26, y
Homebrew intenta compilar Node desde fuente, lo que tarda cerca de una hora.
Se instaló el binario oficial de nodejs.org v24.20.0 en `~/.local/node` con
symlinks en `/usr/local/bin`.

**División del trabajo entre dos conversaciones.** El SQL, las políticas RLS,
las funciones de Supabase y los workflows de n8n se trabajan en un chat
aparte. El panel React se trabaja en Claude Code. Documentado en el v6 del
documento de estado, sección 11 (no localizado en este equipo al momento de
escribir esta entrada; solo se encontraron v4 y una versión sin numerar en
`~/Downloads/`).

**7 de septiembre de 2026 — Sobre el precio del sistema, si se llegara a
vender.** El costo real por cliente es de $1,500 a $2,500 MXN al mes contando
infraestructura y tiempo de soporte, así que una mensualidad por debajo de
$3,000 no deja margen. Los rangos que se manejaron fueron $35,000-60,000 de
implementación más $4,000-7,000 mensuales para el sistema de ventas. Marcos
consideró que está alto para su etapa, y se acordó que el hueco real no es de
precio sino de no tener casos que enseñar. Nota: Meta dejaría de regalar los
mensajes de servicio el 1 de octubre de 2026, según análisis de terceros; esto
falta verificar contra la tarjeta de tarifas oficial de Meta para México.

**7 de septiembre de 2026 — `cotizaciones.fecha` sí existe.** Se decidió
usarla como fecha del documento del PDF, revirtiendo el cambio a `created_at`
del commit anterior (66c9029), que se había hecho siguiendo un documento
desactualizado. Verificado contra `information_schema` en el commit 4c7156b.
Ver la sección de trampas para el detalle.

## Cambios, por fecha

**7 de septiembre de 2026 — Arreglar los bugs que hacían que el panel
mintiera (commit c02ef44).** Revisión completa de las siete pantallas: no
agregó funciones, corrigió cosas que ya se intentaban hacer y fallaban en
silencio. Búsqueda por texto sin dígitos devolvía el catálogo completo en
clientes, prospectos y conversaciones. El saldo de facturas usaba `||` en vez
de manejar cero explícitamente, así que una factura pagada volvía a mostrar el
total como pendiente, y cobrar el anticipo no bajaba el saldo. El update de
órdenes mandaba la relación anidada `cotizaciones` y PostgREST lo rechazaba,
así que ningún botón de editar servía. Configuración hacía `UPDATE` sobre una
tabla vacía (cero filas afectadas, sin error) y decía "guardada
correctamente" sin guardar nada; además el anticipo por defecto decía 50%
cuando la regla del negocio es 70%, y se quitó el campo de API key del PAC
porque esa tabla se lee desde el navegador. "Ver conversación" en prospectos
llevaba a una lista vacía en vez de abrir la conversación del número.

**7 de septiembre de 2026 — El aviso de PDF desfasado ahora vive en la base
(commit c56a86d).** La columna `pdf_vigente` la pone en `false` el trigger al
cambiar partidas y n8n la regresa a `true` al generar el PDF. Antes la marca
solo duraba la sesión del navegador: al recargar se perdía y un PDF viejo
volvía a verse como vigente. En la tabla de cotizaciones, el icono del PDF
sale en ámbar cuando no corresponde a las partidas actuales.

**7 de septiembre de 2026 — Alta de cotizaciones desde el panel y corrección
de fechas (commit 4c7156b).** Se agregó el botón "Nueva cotización" (cliente,
solicitud opcional, con_iva); el folio y la fecha los asigna la base
(secuencia y `CURRENT_DATE`) para que no choquen con los que crea el bot. Solo
se ofrecen solicitudes sin cotización porque el índice
`cotizaciones_solicitud_uniq` permite una por solicitud. Se corrigió que
`cotizaciones.fecha` sí existe (ver decisiones) y que un `date` de Postgres
llega como cadena y el navegador lo interpretaba en UTC, mostrando el día
anterior. Se avisa en la pestaña de partidas y sobre el visor cuando el PDF ya
no corresponde a las partidas editadas.

**7 de septiembre de 2026 — Landing page de Zentec (commit 3d96189).** Piel
clara, opuesta a la del panel, agregada en `landing/` dentro del mismo repo.

**7 de septiembre de 2026 — Login, tema oscuro y las pantallas que faltaban
(commit 66c9029).** El panel no tenía autenticación y, con RLS ya activo en
Supabase, no mostraba datos. Se agregó login con Supabase Auth y lectura del
rol desde `perfiles` (tolerante a que la tabla no exista). Se destapó que el
evento de cambio de sesión se dispara en cada renovación de token y cada vez
que vuelve el foco a la pestaña: sin candado, repetía la consulta del perfil
cientos de veces (325 peticiones en una sesión). Se agregaron las pantallas de
conversaciones (sobre `bot_conversaciones`, porque la Cloud API de Meta no
tiene bandeja de entrada), prospectos con filtro de enfriamiento, detalle de
cotización en cajón lateral con PDF embebido, y el tablero con las cuatro
métricas del plan. Se estableció el tema oscuro con acento cian. `.env` salió
del índice de git, con `.env.example` en su lugar.

**10 de junio de 2026 — Panel Zentec inicial (commit f47b0c7).** Primera
versión del panel: estructura base y las siete pantallas sin autenticación ni
datos reales conectados todavía.

## Cosas que ya costaron tiempo

- **`cotizaciones.fecha` sí existe**, es un `date` con default `CURRENT_DATE`.
  Un documento decía que no, y por seguir ese documento el código se cambió a
  `created_at` en el commit 66c9029; hubo que revertirlo en 4c7156b tras
  verificar contra `information_schema`. Regla: ante contradicción entre
  documentos, gana lo verificado contra `information_schema`.
- **La tabla `productos` tiene más columnas de las documentadas**:
  `imagen_url`, `clave_sat`, `unidad_sat`, `activo`, `created_at`.
- **`cotizacion_productos` tiene `descripcion_extra`**, que no aparecía en
  ningún DDL revisado y es texto que sí se imprime en el PDF.
- **`"cualquierCosa".includes("")` es `true` en JavaScript.** Ese detalle
  rompió la búsqueda en tres pantallas (clientes, prospectos, conversaciones):
  al escribir texto sin dígitos, el filtro por teléfono dejaba pasar todas las
  filas.
- **Un `UPDATE` sobre una fila que no existe afecta cero renglones y no
  devuelve error.** Por eso la pantalla de configuración decía "guardada
  correctamente" sin haber guardado nada.
- **`0 || x` en JavaScript da `x`**, porque cero es falso. Por eso una factura
  pagada mostraba el total como saldo pendiente en vez de cero.
- **PostgREST rechaza un update que incluya relaciones anidadas.** Mandar la
  fila completa que devolvió un `select *, cotizaciones(...)` hacía que ningún
  botón de editar órdenes funcionara.
- **Un `date` de Postgres llega como `"2026-09-03"` y el navegador lo
  interpreta en UTC**, mostrando el día anterior si no se parte a mano.
- **Los documentos de estado se contradicen entre sí**, y además están
  repartidos en varias carpetas. La versión vigente es la v6 y vive en
  `~/Downloads/files/zentec-sistema-estado-v6.md`, no directamente en
  `~/Downloads/`, donde solo quedaron la v4 y una versión sin numerar. Buscar
  ahí y no encontrarla ya costó una vuelta. Cuando haya conflicto entre
  documentos, gana lo verificado contra `information_schema` o contra el
  propio código, y se anota aquí cuál ganó.

## Pendientes conocidos

**Del lado de la base y n8n** (se trabajan en un chat aparte, no en Claude
Code): las funciones de orden y factura, el vocabulario de estados con CHECK,
las columnas `aprobada_at` / `rechazada_at` / `motivo_rechazo`, el webhook de
regenerar PDF, las políticas RLS por empresa (hoy son `using (true)` para
autenticados, provisional mientras haya un solo usuario), la tabla `perfiles`
(no existe todavía), y el respaldo de `/local-files`, que no tiene copia
automática.

**Del lado del panel:** conectar los botones de crear orden y generar factura
cuando existan las funciones correspondientes en la base, y el selector de
motivo de rechazo en cotizaciones.

**Botón de reenviar cotización por WhatsApp:** no se conecta hasta que exista
plantilla aprobada por Meta (ver decisiones). Mientras tanto queda el enlace
wa.me.

**Repo del panel de agenda:** no se ha creado todavía; se decidió que va
aparte del panel de Zentec (ver decisiones).

**Push a remoto:** los seis commits del panel son locales, no se ha hecho
`git push`.

**Verificación pendiente:** la fecha del 1 de octubre de 2026 en que Meta
dejaría de regalar mensajes de servicio, contra la tarjeta de tarifas oficial
de Meta para México.
