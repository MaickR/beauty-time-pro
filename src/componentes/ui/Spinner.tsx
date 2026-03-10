interface PropsSpinner {
  tamaño?: 'sm' | 'md' | 'lg';
}

export function Spinner({ tamaño = 'md' }: PropsSpinner) {
  const clases = {
    sm: 'h-6 w-6 border-2',
    md: 'h-12 w-12 border-b-2',
    lg: 'h-16 w-16 border-b-2',
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`animate-spin rounded-full border-pink-600 ${clases[tamaño]}`}
        aria-busy="true"
        aria-label="Cargando"
      />
    </div>
  );
}
