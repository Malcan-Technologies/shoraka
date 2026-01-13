import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateActivityInput, GetActivitiesQuery } from "./schemas";

export const activityRepository = {
  /**
   * Find activities with filtering and pagination
   */
  async findActivities(userId: string, query: GetActivitiesQuery) {
    const { page, limit, search, type, types, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityWhereInput = {
      user_id: userId,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (type) {
      where.activity_type = type;
    } else if (types && types.length > 0) {
      where.activity_type = { in: types };
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.activity.count({ where }),
    ]);

    return {
      activities,
      total,
      pages: Math.ceil(total / limit),
    };
  },

  /**
   * Create a new activity log
   */
  async createActivity(data: CreateActivityInput) {
    return prisma.activity.create({
      data,
    });
  },

  /**
   * Get activity by ID
   */
  async findById(id: string) {
    return prisma.activity.findUnique({
      where: { id },
    });
  },
};
