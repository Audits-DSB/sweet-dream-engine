interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      <div className="stat-card flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <span className="text-2xl">🚧</span>
        </div>
        <h3 className="font-semibold text-lg">Coming Soon</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          This module is under development. We're building it step by step to ensure quality.
        </p>
      </div>
    </div>
  );
}
