import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOCATION_ACTION = "TIAK_LOCATION_PING";
const shareableStatuses = new Set(["ACCEPTED", "PICKED_UP", "DELIVERED"]);
const geocodeCache = new Map<string, { expiresAt: number; value: { latitude: number; longitude: number } | null }>();
const routeCache = new Map<
  string,
  {
    expiresAt: number;
    value: {
      waypointType: "PICKUP" | "DROPOFF" | null;
      waypointLabel: string | null;
      distanceMeters: number | null;
      etaSeconds: number | null;
      source: "osrm" | "geodesic" | "none";
      destination: { latitude: number; longitude: number } | null;
      refreshedAt: string;
    } | null;
  }
>();
const GEOCODE_TTL_MS = 1000 * 60 * 60 * 12;
const ROUTE_TTL_MS = 1000 * 45;
const PROVIDER_TIMEOUT_MS = normalizeProviderTimeout(process.env.TIAK_MAP_PROVIDER_TIMEOUT_MS);
const PUBLIC_PROVIDER_USER_AGENT =
  process.env.TIAK_MAP_PROVIDER_USER_AGENT?.trim() || "JONTAADO/1.0 location eta";
const GEOCODER_ENDPOINT = resolveProviderEndpoint(
  process.env.TIAK_GEOCODER_SEARCH_URL,
  "https://nominatim.openstreetmap.org/search"
);
const ROUTER_ENDPOINT = resolveProviderEndpoint(
  process.env.TIAK_ROUTER_URL,
  "https://router.project-osrm.org/route/v1/driving"
);

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeCoordinate(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return Number(parsed.toFixed(6));
}

function normalizeNullableNumber(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > max) return null;
  return Number(parsed.toFixed(2));
}

function normalizeProviderTimeout(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3_500;
  return Math.min(10_000, Math.max(1_500, Math.trunc(parsed)));
}

function resolveProviderEndpoint(configuredValue: string | undefined, fallback: string) {
  const trimmed = configuredValue?.trim();
  if (trimmed) return trimmed;
  return process.env.TIAK_ALLOW_PUBLIC_MAP_PROVIDERS === "0" ? null : fallback;
}

function toLocationPayload(log: {
  id: string;
  createdAt: Date;
  metadata: Prisma.JsonValue;
  userId: string;
}) {
  const metadata =
    log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
      ? (log.metadata as Record<string, unknown>)
      : null;

  const latitude = normalizeCoordinate(metadata?.latitude, -90, 90);
  const longitude = normalizeCoordinate(metadata?.longitude, -180, 180);
  if (latitude === null || longitude === null) return null;

  return {
    id: log.id,
    actorId: log.userId,
    latitude,
    longitude,
    accuracy: normalizeNullableNumber(metadata?.accuracy, 10_000),
    heading: normalizeNullableNumber(metadata?.heading, 360),
    speed: normalizeNullableNumber(metadata?.speed, 1_000),
    createdAt: log.createdAt.toISOString(),
  };
}

async function loadDelivery(deliveryId: string) {
  return prisma.tiakDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      customerId: true,
      courierId: true,
      status: true,
      pickupAddress: true,
      dropoffAddress: true,
    },
  });
}

function normalizeAddress(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function getNextWaypoint(delivery: {
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
}) {
  if (delivery.status === "ACCEPTED") {
    return {
      waypointType: "PICKUP" as const,
      waypointLabel: normalizeAddress(delivery.pickupAddress) || null,
    };
  }

  if (delivery.status === "PICKED_UP") {
    return {
      waypointType: "DROPOFF" as const,
      waypointLabel: normalizeAddress(delivery.dropoffAddress) || null,
    };
  }

  return {
    waypointType: null,
    waypointLabel: null,
  };
}

function haversineDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);
  const startLatitude = toRadians(fromLatitude);
  const endLatitude = toRadians(toLatitude);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2) *
      Math.cos(startLatitude) *
      Math.cos(endLatitude);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
}

async function fetchJsonWithTimeout<T>(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": PUBLIC_PROVIDER_USER_AGENT,
      },
      next: { revalidate: 0 },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as T | null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeAddress(address: string) {
  const trimmed = normalizeAddress(address);
  if (!trimmed) return null;

  const cached = geocodeCache.get(trimmed);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!GEOCODER_ENDPOINT) {
    geocodeCache.set(trimmed, { expiresAt: Date.now() + 60_000, value: null });
    return null;
  }

  try {
    const url = new URL(GEOCODER_ENDPOINT);
    url.searchParams.set("q", trimmed);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");

    const data = await fetchJsonWithTimeout<Array<{ lat?: string; lon?: string }>>(url);
    if (!data) {
      geocodeCache.set(trimmed, { expiresAt: Date.now() + 60_000, value: null });
      return null;
    }

    const first = Array.isArray(data) ? data[0] : null;
    const latitude = normalizeCoordinate(first?.lat, -90, 90);
    const longitude = normalizeCoordinate(first?.lon, -180, 180);
    const value =
      latitude !== null && longitude !== null ? { latitude, longitude } : null;

    geocodeCache.set(trimmed, { expiresAt: Date.now() + GEOCODE_TTL_MS, value });
    return value;
  } catch {
    geocodeCache.set(trimmed, { expiresAt: Date.now() + 60_000, value: null });
    return null;
  }
}

async function buildRouteMeta(params: {
  delivery: {
    status: string;
    pickupAddress: string;
    dropoffAddress: string;
  };
  location: {
    latitude: number;
    longitude: number;
    speed: number | null;
  };
}) {
  const waypoint = getNextWaypoint(params.delivery);
  if (!waypoint.waypointType || !waypoint.waypointLabel) {
    return {
      waypointType: null,
      waypointLabel: null,
      distanceMeters: null,
      etaSeconds: null,
      source: "none" as const,
      destination: null,
      refreshedAt: new Date().toISOString(),
    };
  }

  const destination = await geocodeAddress(waypoint.waypointLabel);
  if (!destination) {
    return {
      waypointType: waypoint.waypointType,
      waypointLabel: waypoint.waypointLabel,
      distanceMeters: null,
      etaSeconds: null,
      source: "none" as const,
      destination: null,
      refreshedAt: new Date().toISOString(),
    };
  }

  const cacheKey = [
    waypoint.waypointType,
    waypoint.waypointLabel,
    params.location.latitude.toFixed(4),
    params.location.longitude.toFixed(4),
  ].join(":");
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const directDistanceMeters = haversineDistanceMeters(
    params.location.latitude,
    params.location.longitude,
    destination.latitude,
    destination.longitude
  );

  const fallbackSpeedMetersPerSecond =
    params.location.speed && params.location.speed > 0 ? params.location.speed : 7.5;
  const fallbackEtaSeconds = Math.max(60, Math.round(directDistanceMeters / fallbackSpeedMetersPerSecond));

  if (ROUTER_ENDPOINT) {
    try {
      const url = new URL(
        `${ROUTER_ENDPOINT}/${params.location.longitude},${params.location.latitude};${destination.longitude},${destination.latitude}`
      );
      url.searchParams.set("overview", "false");
      url.searchParams.set("alternatives", "false");
      url.searchParams.set("steps", "false");

      const data = await fetchJsonWithTimeout<{
        routes?: Array<{
          distance?: number;
          duration?: number;
        }>;
      }>(url);

      const route = Array.isArray(data?.routes) ? data?.routes[0] : null;
      if (route) {
        const distanceMeters =
          typeof route.distance === "number" && Number.isFinite(route.distance)
            ? Math.round(route.distance)
            : directDistanceMeters;
        const etaSeconds =
          typeof route.duration === "number" && Number.isFinite(route.duration)
            ? Math.max(60, Math.round(route.duration))
            : fallbackEtaSeconds;

        const value = {
          waypointType: waypoint.waypointType,
          waypointLabel: waypoint.waypointLabel,
          distanceMeters,
          etaSeconds,
          source: "osrm" as const,
          destination,
          refreshedAt: new Date().toISOString(),
        };
        routeCache.set(cacheKey, { expiresAt: Date.now() + ROUTE_TTL_MS, value });
        return value;
      }
    } catch {
      // fallback below
    }
  }

  const fallbackValue = {
    waypointType: waypoint.waypointType,
    waypointLabel: waypoint.waypointLabel,
    distanceMeters: directDistanceMeters,
    etaSeconds: fallbackEtaSeconds,
    source: "geodesic" as const,
    destination,
    refreshedAt: new Date().toISOString(),
  };
  routeCache.set(cacheKey, { expiresAt: Date.now() + ROUTE_TTL_MS, value: fallbackValue });
  return fallbackValue;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await params;
  const delivery = await loadDelivery(id);
  if (!delivery) {
    return errorResponse(404, "DELIVERY_NOT_FOUND", "Delivery not found.");
  }

  const isAdmin = session.user.role === "ADMIN";
  const isParticipant =
    session.user.id === delivery.customerId || session.user.id === delivery.courierId;

  if (!isAdmin && !isParticipant) {
    return errorResponse(403, "FORBIDDEN", "Only delivery participants can read location.");
  }

  const latest = await prisma.activityLog.findFirst({
    where: {
      action: LOCATION_ACTION,
      entityType: "TiakDelivery",
      entityId: delivery.id,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      userId: true,
      metadata: true,
      createdAt: true,
    },
  });

  const location = latest ? toLocationPayload(latest) : null;
  if (!location) {
    return NextResponse.json(null);
  }

  const route = await buildRouteMeta({
    delivery,
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed,
    },
  });

  return NextResponse.json({
    ...location,
    route,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await params;
  const delivery = await loadDelivery(id);
  if (!delivery) {
    return errorResponse(404, "DELIVERY_NOT_FOUND", "Delivery not found.");
  }

  const isAdmin = session.user.role === "ADMIN";
  const isAssignedCourier = session.user.id === delivery.courierId;

  if (!isAdmin && !isAssignedCourier) {
    return errorResponse(403, "FORBIDDEN", "Only assigned courier can publish location.");
  }

  if (!shareableStatuses.has(delivery.status)) {
    return errorResponse(409, "INVALID_STATUS", "Location sharing is available only during active delivery steps.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const latitude = normalizeCoordinate((body as { latitude?: unknown }).latitude, -90, 90);
  const longitude = normalizeCoordinate((body as { longitude?: unknown }).longitude, -180, 180);
  if (latitude === null || longitude === null) {
    return errorResponse(400, "INVALID_COORDINATES", "latitude and longitude are required.");
  }

  const accuracy = normalizeNullableNumber((body as { accuracy?: unknown }).accuracy, 10_000);
  const heading = normalizeNullableNumber((body as { heading?: unknown }).heading, 360);
  const speed = normalizeNullableNumber((body as { speed?: unknown }).speed, 1_000);

  const log = await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: LOCATION_ACTION,
      entityType: "TiakDelivery",
      entityId: delivery.id,
      metadata: {
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
      } as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      userId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json(toLocationPayload(log), { status: 201 });
}
