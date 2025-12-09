"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUpdateUserId } from "@/hooks/use-admin-users";

const schema = z.object({
  userId: z
    .string()
    .length(5, "User ID must be exactly 5 characters")
    .regex(/^[A-Z]{5}$/, "User ID must contain only uppercase letters (A-Z)"),
});

type FormValues = z.infer<typeof schema>;

interface EditUserIdDialogProps {
  user: {
    id: string;
    user_id: string | null;
    first_name: string;
    last_name: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newUserId: string) => void;
}

export function EditUserIdDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: EditUserIdDialogProps) {
  const updateUserId = useUpdateUserId();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { userId: user.user_id || "" },
  });

  // Reset form with current user_id whenever dialog opens or user changes
  useEffect(() => {
    if (open) {
      form.reset({ userId: user.user_id || "" });
    }
  }, [open, user.user_id, form]);

  const onSubmit = async (data: FormValues) => {
    const newUserId = await updateUserId.mutateAsync({
      userId: user.id,
      newUserId: data.userId,
    });
    
    onSuccess(newUserId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User ID</DialogTitle>
          <DialogDescription>
            Update the 5-letter User ID for {user.first_name} {user.last_name}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User ID (5 uppercase letters)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="ABCDE"
                      maxLength={5}
                      className="font-mono uppercase"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateUserId.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserId.isPending}>
                {updateUserId.isPending ? "Updating..." : "Update"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

