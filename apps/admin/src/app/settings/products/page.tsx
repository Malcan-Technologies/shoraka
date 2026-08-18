"use client";

import { ProductsList } from "./components/products-list";
import { RequirePermission } from "../../../components/require-permission";

export default function SettingsProductsPage() {
  return (
    <RequirePermission permission="products.view">
      <>
      
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full px-2 md:px-4 py-8 space-y-6">
          <ProductsList />
        </div>
      </div>
      </>
    </RequirePermission>
  );
}
