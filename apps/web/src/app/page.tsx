import { APP_NAME } from "@mygridfinity/shared";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="text-base opacity-70">
        Parametric Gridfinity baseplate and bin generator.
      </p>
      <p className="text-sm opacity-50">Scaffolded. Renderer wiring next.</p>
    </main>
  );
}
