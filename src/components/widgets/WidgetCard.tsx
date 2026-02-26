import type { PropsWithChildren } from 'react';

interface WidgetCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export const WidgetCard = ({ title, subtitle, children }: WidgetCardProps) => (
  <article className="widget-card">
    <header className="widget-card__header">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
    <section className="widget-card__body">{children}</section>
  </article>
);
