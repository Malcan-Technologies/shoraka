import { prisma } from "../../lib/prisma";
import { NotificationGroup, Prisma } from "@prisma/client";

export class NotificationGroupRepository {
  /**
   * Create a new notification group
   */
  async create(data: Prisma.NotificationGroupCreateInput): Promise<NotificationGroup> {
    return prisma.notificationGroup.create({
      data,
    });
  }

  /**
   * Find group by ID
   */
  async findById(id: string): Promise<NotificationGroup | null> {
    return prisma.notificationGroup.findUnique({
      where: { id },
    });
  }

  /**
   * List all notification groups
   */
  async findAll(): Promise<NotificationGroup[]> {
    return prisma.notificationGroup.findMany({
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Update a notification group
   */
  async update(id: string, data: Prisma.NotificationGroupUpdateInput): Promise<NotificationGroup> {
    return prisma.notificationGroup.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a notification group
   */
  async delete(id: string): Promise<NotificationGroup> {
    return prisma.notificationGroup.delete({
      where: { id },
    });
  }
}
