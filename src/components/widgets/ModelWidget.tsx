import { useEffect } from 'react';
import type { ModelWidgetConfig } from '../../types/dashboard';
import { WidgetCard } from './WidgetCard';

interface ModelWidgetProps {
  config: ModelWidgetConfig;
}

export const ModelWidget = ({ config }: ModelWidgetProps) => {
  useEffect(() => {
    void import('@google/model-viewer');
  }, []);

  return (
    <WidgetCard title={config.title} subtitle={config.subtitle}>
      <div className="model-widget">
        <model-viewer
          src={config.src}
          alt={config.alt || config.title}
          camera-controls={config.cameraControls ?? true}
          auto-rotate={config.autoRotate ?? true}
          loading="eager"
          reveal="auto"
          shadow-intensity="1"
          interaction-prompt="auto"
        />
      </div>
    </WidgetCard>
  );
};
