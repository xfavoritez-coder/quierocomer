export default function CartaLoading() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-3 border-[#F4A623] border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 font-[family-name:var(--font-dm)] text-sm">
          Cargando carta...
        </p>
      </div>
    </div>
  );
}
