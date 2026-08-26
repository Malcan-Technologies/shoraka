import { NotificationTypeIds } from "./registry";
import { initialNotificationTypes } from "./seed-data";

describe("notification catalog", () => {
  it("keeps seed rows aligned with the typed registry", () => {
    const seedIds = initialNotificationTypes.map((type) => type.id).sort();
    const registryIds = Object.values(NotificationTypeIds).sort();
    expect(seedIds).toEqual(registryIds);
  });
});
