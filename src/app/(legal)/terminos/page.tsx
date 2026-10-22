import { LEGAL } from "@/lib/legal-config";
import { formatFullDateStr } from "@/lib/date";

export const metadata = { title: "Términos de servicio · Centro de Operaciones" };

export default function TerminosPage() {
  return (
    <>
      <h1>Términos de servicio</h1>
      <p>Última actualización: {formatFullDateStr(LEGAL.updatedOn)}.</p>

      <h2>1. Qué es {LEGAL.product}</h2>
      <p>
        {LEGAL.product} ({LEGAL.domain}) es una herramienta interna de {LEGAL.operator} para gestionar
        sus propias operaciones. El acceso está restringido a personas autorizadas por{" "}
        {LEGAL.operator} mediante credenciales privadas. No se ofrece como servicio a terceros ni
        admite registro público.
      </p>

      <h2>2. Cuentas de redes sociales conectadas</h2>
      <p>
        Quien conecta una cuenta de Instagram o TikTok declara ser su titular o contar con
        autorización de la persona titular. La conexión otorga a la herramienta permisos de{" "}
        <strong>lectura</strong> sobre perfil, publicaciones y métricas, que se pueden revocar en
        cualquier momento desde el panel o desde la configuración de cada plataforma. El uso de esas
        API está sujeto además a los términos de Meta y de TikTok.
      </p>

      <h2>3. Uso aceptable</h2>
      <ul>
        <li>Usar la herramienta sólo para las cuentas y negocios propios de {LEGAL.operator}.</li>
        <li>No intentar acceder a datos de otras personas ni eludir los controles de acceso.</li>
        <li>No usar la información obtenida para fines contrarios a las políticas de las plataformas.</li>
      </ul>

      <h2>4. Sugerencias generadas automáticamente</h2>
      <p>
        Las ideas y guiones que produce la herramienta se generan con un modelo de lenguaje a partir
        del contenido ya publicado. Son un punto de partida: la revisión, la decisión de publicar y la
        responsabilidad por lo publicado son siempre de la persona usuaria.
      </p>

      <h2>5. Disponibilidad y garantías</h2>
      <p>
        La herramienta se ofrece «tal cual», sin garantía de disponibilidad continua ni de exactitud
        de las métricas, que dependen de lo que devuelven las plataformas y pueden llegar con demora.
        {LEGAL.operator} puede modificar o discontinuar funciones sin previo aviso.
      </p>

      <h2>6. Privacidad</h2>
      <p>
        El tratamiento de datos se describe en la <a href="/privacidad">política de privacidad</a>,
        que forma parte de estos términos.
      </p>

      <h2>7. Contacto</h2>
      <p>
        Consultas sobre estos términos: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
    </>
  );
}
