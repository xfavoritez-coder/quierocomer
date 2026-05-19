import type { Metadata } from "next";
import ProductosClient from "./ProductosClient";

export const metadata: Metadata = {
  title: "Productos | QuieroComer",
  description: "Descubre lo que estamos preparando para transformar la experiencia gastronómica.",
};

export default function ProductosPage() {
  return <ProductosClient />;
}
