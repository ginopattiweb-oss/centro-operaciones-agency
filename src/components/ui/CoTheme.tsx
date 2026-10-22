/**
 * Marca una vista como migrada al sistema oscuro y fija fondo y color base.
 * Las fuentes las carga el layout raíz; acá sólo se activa el scope `.co`.
 */
export function CoTheme({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`co ${className}`}>{children}</div>;
}
