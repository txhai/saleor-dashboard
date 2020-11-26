import { stringify as stringifyQs } from "qs";
import urlJoin from "url-join";

import { BulkAction, Dialog, Pagination, SingleAction } from "../types";
import { ShippingMethodTypeEnum } from "../types/globalTypes";

export const shippingSection = "/shipping/";

export const shippingZonesListPath = shippingSection;
export type ShippingZonesListUrlDialog = "remove" | "remove-many";
export type ShippingZonesListUrlQueryParams = BulkAction &
  Dialog<ShippingZonesListUrlDialog> &
  Pagination &
  SingleAction;
export const shippingZonesListUrl = (
  params?: ShippingZonesListUrlQueryParams
) => shippingZonesListPath + "?" + stringifyQs(params);

export const shippingZonePath = (id: string) =>
  urlJoin(shippingZonesListPath, id);
export type ShippingZoneUrlDialog =
  | "add-rate"
  | "add-warehouse"
  | "assign-country"
  | "edit-rate"
  | "remove"
  | "remove-rate"
  | "unassign-country";

export type ShippingMethodDialog = "assign-product" | "remove";

export type ShippingMethodUrlQueryParams = Dialog<ShippingMethodDialog> &
  SingleAction &
  BulkAction &
  Pagination;

export type ShippingZoneUrlQueryParams = Dialog<ShippingZoneUrlDialog> &
  SingleAction &
  Partial<{
    type: ShippingMethodTypeEnum;
  }> &
  Pagination;
export const shippingZoneUrl = (
  id: string,
  params?: ShippingZoneUrlQueryParams
) => shippingZonePath(encodeURIComponent(id)) + "?" + stringifyQs(params);

export const shippingPriceRatesUrl = (id: string) =>
  urlJoin(shippingZonePath(id), "price", "add");

export const shippingWeightRatesUrl = (id: string) =>
  urlJoin(shippingZonePath(id), "weight", "add");

export const shippingWeightRatesEditUrl = (
  id: string,
  rateId: string,
  params?: ShippingMethodUrlQueryParams
) =>
  urlJoin(shippingZonePath(id), "weight", rateId) + "?" + stringifyQs(params);

export const shippingPriceRatesEditUrl = (
  id: string,
  rateId: string,
  params?: ShippingMethodUrlQueryParams
) => urlJoin(shippingZonePath(id), "price", rateId) + "?" + stringifyQs(params);

export const shippingZoneAddPath = urlJoin(shippingZonesListPath, "add");
export const shippingZoneAddUrl = shippingZoneAddPath;
export const shippingPriceRatesAddPath = urlJoin(
  shippingZonesListPath,
  "price",
  "add"
);
