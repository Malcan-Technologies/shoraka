"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useDeleteProduct } from "@/hooks/use-products";
import { EditProductDialog } from "./edit-product-dialog";

interface ProductTableRowProps {
  product: any;
}

export function ProductTableRow({ product }: ProductTableRowProps) {
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const deleteProduct = useDeleteProduct();

  const handleDelete = async () => {
    try {
      await deleteProduct.mutateAsync({ productId: product.id });
      setShowDeleteDialog(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">
          <div className="flex flex-col">
            <span>{product.name}</span>
            {product.description && (
              <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {product.description}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm">{product.category || ""}</span>
        </TableCell>
        <TableCell>
          <span className="text-sm">{product.steps || 0} step{product.steps !== 1 ? 's' : ''}</span>
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">
            {product.createdAt
              ? format(new Date(product.createdAt), "MMM dd, yyyy")
              : " "}
          </span>
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">
            {product.updatedAt
              ? formatDistanceToNow(new Date(product.updatedAt), { addSuffix: true })
              : " "}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEditDialog(true)}
              className="h-8"
            >
              <PencilIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8 text-destructive hover:text-destructive"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <EditProductDialog
        product={product}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{product.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProduct.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteProduct.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProduct.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

