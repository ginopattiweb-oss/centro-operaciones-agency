/**
 * Envuelve las vistas del scope "Sol de Mayo" (la agencia y la sección
 * transversal de Tareas). Las fuentes ahora se cargan en el layout raíz, así
 * que esto sólo activa el scope `.sp`, que es una capa de alias sobre los
 * tokens del sistema oscuro (ver globals.css).
 */
export function PanelTheme({ children }: { children: React.ReactNode }) {
  return <div className="sp min-h-full">{children}</div>;
}
