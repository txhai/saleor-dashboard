import { AttributeInputData } from "@saleor/components/Attributes";
import { FormChange } from "@saleor/hooks/useForm";
import {
  FormsetAtomicData,
  FormsetChange,
  FormsetData
} from "@saleor/hooks/useFormset";
import { toggle } from "@saleor/utils/lists";

import { getAttributeInputFromProductType, ProductType } from "./data";

export function createAttributeChangeHandler(
  changeAttributeData: FormsetChange<string[]>,
  triggerChange: () => void
): FormsetChange<string> {
  return (attributeId: string, value: string) => {
    triggerChange();
    changeAttributeData(attributeId, value === "" ? [] : [value]);
  };
}

export function createAttributeMultiChangeHandler(
  changeAttributeData: FormsetChange<string[]>,
  attributes: FormsetData<AttributeInputData, string[]>,
  triggerChange: () => void
): FormsetChange<string> {
  return (attributeId: string, value: string) => {
    const attribute = attributes.find(
      attribute => attribute.id === attributeId
    );

    const newAttributeValues = toggle(
      value,
      attribute.value,
      (a, b) => a === b
    );

    triggerChange();
    changeAttributeData(attributeId, newAttributeValues);
  };
}

export function createAttributeFileChangeHandler(
  changeAttributeData: FormsetChange<string[]>,
  attributesWithNewFileValue: FormsetData<FormsetData<null, File>>,
  addAttributeNewFileValue: (data: FormsetAtomicData<null, File>) => void,
  removeAttributeNewFileValue: (id: string) => void,
  triggerChange: () => void
): FormsetChange<File> {
  return (attributeId: string, value: File) => {
    triggerChange();
    if (value) {
      addAttributeNewFileValue({
        data: null,
        id: attributeId,
        label: null,
        value
      });
    } else {
      const removeingNewFileValue = attributesWithNewFileValue.find(
        attribute => attribute.id === attributeId
      );
      if (removeingNewFileValue) {
        removeAttributeNewFileValue(attributeId);
      } else {
        changeAttributeData(attributeId, []);
      }
    }
  };
}

export function createProductTypeSelectHandler(
  setAttributes: (data: FormsetData<AttributeInputData>) => void,
  setProductType: (productType: ProductType) => void,
  productTypeChoiceList: ProductType[],
  triggerChange: () => void
): FormChange {
  return (event: React.ChangeEvent<any>) => {
    const id = event.target.value;
    const selectedProductType = productTypeChoiceList.find(
      productType => productType.id === id
    );
    triggerChange();
    setProductType(selectedProductType);
    setAttributes(getAttributeInputFromProductType(selectedProductType));
  };
}

interface ProductAvailabilityArgs {
  availableForPurchase: string | null;
  isAvailableForPurchase: boolean;
  productId: string;
}

export const getProductAvailabilityVariables = ({
  isAvailableForPurchase,
  availableForPurchase,
  productId
}: ProductAvailabilityArgs) => ({
  isAvailable: isAvailableForPurchase,
  productId,
  startDate: availableForPurchase || null
});
