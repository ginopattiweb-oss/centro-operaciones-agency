import { LEGAL } from "@/lib/legal-config";
import { formatFullDateStr } from "@/lib/date";

export const metadata = { title: "Política de privacidad · Centro de Operaciones" };

export default function PrivacidadPage() {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p>Última actualización: {formatFullDateStr(LEGAL.updatedOn)}.</p>

      <p>
        {LEGAL.product} ({LEGAL.domain}) es una herramienta interna de gestión operada por{" "}
        {LEGAL.operator}. La usa exclusivamente el equipo de {LEGAL.operator} para administrar sus
        propias unidades de negocio: proyectos, tareas, finanzas y las cuentas de redes sociales
        que el propio equipo decide conectar. No es un servicio abierto al público ni se ofrece a
        terceros.
      </p>

      <h2>Qué datos tratamos</h2>
      <p>Cuando una persona del equipo conecta una cuenta de Instagram o TikTok, la herramienta accede, con su autorización expresa, a:</p>
      <ul>
        <li>Datos públicos del perfil: nombre de usuario, nombre, foto, biografía y tipo de cuenta.</li>
        <li>Contadores de la cuenta: seguidores, seguidos, cantidad de publicaciones y me gusta totales.</li>
        <li>Listado de publicaciones y videos con sus métricas: vistas, alcance, me gusta, comentarios, guardados y compartidos.</li>
        <li>Métricas agregadas de la cuenta (alcance, vistas, interacciones, visitas al perfil) dentro de los períodos consultados.</li>
        <li>Los tokens de acceso que otorga cada plataforma para leer esa información.</li>
      </ul>
      <p>
        No accedemos a mensajes privados, contactos, contraseñas ni a datos de otras personas
        distintas de la cuenta conectada. No publicamos contenido en nombre de la cuenta.
      </p>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Mostrar al equipo un panel con la evolución de sus propias cuentas.</li>
        <li>Guardar un registro diario de contadores para ver tendencias en el tiempo.</li>
        <li>Generar sugerencias de contenido nuevo a partir de las publicaciones ya realizadas.</li>
      </ul>
      <p>No usamos los datos con fines publicitarios, no construimos perfiles de terceros y no vendemos ni cedemos información a nadie.</p>

      <h2>Dónde se guardan y por cuánto tiempo</h2>
      <p>
        Los datos se almacenan en una base de datos privada, accesible sólo con la sesión del panel.
        Los tokens de acceso se guardan cifrados (AES-256-GCM) y nunca se exponen en el navegador.
        Conservamos los datos mientras la cuenta esté conectada. Al desconectar una cuenta desde el
        panel se borran su registro, sus tokens y su historial de métricas.
      </p>

      <h2>Proveedores</h2>
      <p>
        Para funcionar usamos servicios de infraestructura que procesan datos en nuestro nombre:
        alojamiento y ejecución (Vercel), base de datos (Neon) y, para las sugerencias de contenido,
        un modelo de lenguaje (Anthropic) al que se envían las descripciones y métricas de las
        publicaciones, nunca los tokens de acceso. Los datos de redes sociales se obtienen mediante
        las API oficiales de Meta (Instagram) y TikTok, sujetas a sus propias políticas.
      </p>

      <h2>Tus derechos y cómo revocar el acceso</h2>
      <ul>
        <li>Desde el panel: Contenido → Cuentas → Desconectar. Borra los datos de esa cuenta de inmediato.</li>
        <li>Desde Instagram: Configuración → Sitios web y apps → quitar la app de {LEGAL.operator}.</li>
        <li>Desde TikTok: Configuración y privacidad → Seguridad y permisos → Apps conectadas → quitar acceso.</li>
        <li>
          Para consultas, acceso, rectificación o borrado de datos: escribinos a{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. Respondemos en un plazo
          razonable y sin costo.
        </li>
      </ul>

      <h2>Cambios</h2>
      <p>Si esta política cambia, actualizamos la fecha de arriba. Los cambios rigen desde su publicación en esta página.</p>
    </>
  );
}
