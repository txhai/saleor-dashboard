import { AttributeInput } from "@saleor/components/Attributes";
import { MetadataFormData } from "@saleor/components/Metadata";
import { ProductVariant } from "@saleor/fragments/types/ProductVariant";
import useForm, { FormChange, SubmitPromise } from "@saleor/hooks/useForm";
import useFormset, {
  FormsetChange,
  FormsetData
} from "@saleor/hooks/useFormset";
import {
  getAttributeInputFromVariant,
  getStockInputFromVariant
} from "@saleor/products/utils/data";
import {
  createAttributeChangeHandler,
  createAttributeFileChangeHandler,
  createAttributeMultiChangeHandler
} from "@saleor/products/utils/handlers";
import { SearchWarehouses_search_edges_node } from "@saleor/searches/types/SearchWarehouses";
import { mapMetadataItemToInput } from "@saleor/utils/maps";
import getMetadata from "@saleor/utils/metadata/getMetadata";
import useMetadataChangeTrigger from "@saleor/utils/metadata/useMetadataChangeTrigger";
import { diff } from "fast-array-diff";
import React from "react";

import handleFormSubmit from "../../../utils/handlers/handleFormSubmit";
import { ProductStockInput } from "../ProductStocks";

export interface ProductVariantUpdateFormData extends MetadataFormData {
  costPrice: string;
  price: string;
  sku: string;
  trackInventory: boolean;
  weight: string;
}
export interface ProductVariantUpdateData extends ProductVariantUpdateFormData {
  attributes: AttributeInput[];
  stocks: ProductStockInput[];
}
export interface ProductVariantUpdateSubmitData
  extends ProductVariantUpdateFormData {
  attributes: AttributeInput[];
  attributesWithNewFileValue: FormsetData<null, File>;
  addStocks: ProductStockInput[];
  updateStocks: ProductStockInput[];
  removeStocks: string[];
}

export interface UseProductVariantUpdateFormOpts {
  warehouses: SearchWarehouses_search_edges_node[];
}
interface ProductUpdateHandlers
  extends Record<"changeMetadata", FormChange>,
    Record<
      "changeStock" | "selectAttribute" | "selectAttributeMultiple",
      FormsetChange<string>
    >,
    Record<"selectAttributeFile", FormsetChange<File>>,
    Record<"addStock" | "deleteStock", (id: string) => void> {}

export interface UseProductVariantUpdateFormResult {
  change: FormChange;
  data: ProductVariantUpdateData;
  handlers: ProductUpdateHandlers;
  hasChanged: boolean;
  submit: () => void;
}

export interface ProductVariantUpdateFormProps
  extends UseProductVariantUpdateFormOpts {
  children: (props: UseProductVariantUpdateFormResult) => React.ReactNode;
  variant: ProductVariant;
  onSubmit: (data: ProductVariantUpdateSubmitData) => SubmitPromise;
}

function useProductVariantUpdateForm(
  variant: ProductVariant,
  onSubmit: (data: ProductVariantUpdateSubmitData) => SubmitPromise,
  opts: UseProductVariantUpdateFormOpts
): UseProductVariantUpdateFormResult {
  const [changed, setChanged] = React.useState(false);
  const triggerChange = () => setChanged(true);

  const attributeInput = getAttributeInputFromVariant(variant);
  const stockInput = getStockInputFromVariant(variant);

  const initial: ProductVariantUpdateFormData = {
    costPrice: variant?.costPrice?.amount.toString() || "",
    metadata: variant?.metadata?.map(mapMetadataItemToInput),
    price: variant?.price?.amount.toString() || "",
    privateMetadata: variant?.privateMetadata?.map(mapMetadataItemToInput),
    sku: variant?.sku || "",
    trackInventory: variant?.trackInventory,
    weight: variant?.weight?.value.toString() || ""
  };

  const form = useForm(initial);
  const attributes = useFormset(attributeInput);
  const attributesWithNewFileValue = useFormset<null, File>([]);
  const stocks = useFormset(stockInput);
  const {
    isMetadataModified,
    isPrivateMetadataModified,
    makeChangeHandler: makeMetadataChangeHandler
  } = useMetadataChangeTrigger();

  const handleChange: FormChange = (event, cb) => {
    form.change(event, cb);
    triggerChange();
  };
  const changeMetadata = makeMetadataChangeHandler(handleChange);
  const handleAttributeChange = createAttributeChangeHandler(
    attributes.change,
    triggerChange
  );
  const handleAttributeMultiChange = createAttributeMultiChangeHandler(
    attributes.change,
    attributes.data,
    triggerChange
  );
  const handleAttributeFileChange = createAttributeFileChangeHandler(
    attributes.change,
    attributesWithNewFileValue.data,
    attributesWithNewFileValue.add,
    attributesWithNewFileValue.remove,
    triggerChange
  );
  const handleStockAdd = (id: string) => {
    triggerChange();
    stocks.add({
      data: null,
      id,
      label: opts.warehouses.find(warehouse => warehouse.id === id).name,
      value: "0"
    });
  };
  const handleStockChange = (id: string, value: string) => {
    triggerChange();
    stocks.change(id, value);
  };
  const handleStockDelete = (id: string) => {
    triggerChange();
    stocks.remove(id);
  };

  const dataStocks = stocks.data.map(stock => stock.id);
  const variantStocks = variant?.stocks.map(stock => stock.warehouse.id) || [];
  const stockDiff = diff(variantStocks, dataStocks);

  const addStocks = stocks.data.filter(stock =>
    stockDiff.added.some(addedStock => addedStock === stock.id)
  );
  const updateStocks = stocks.data.filter(
    stock => !stockDiff.added.some(addedStock => addedStock === stock.id)
  );

  const data: ProductVariantUpdateData = {
    ...form.data,
    attributes: attributes.data,
    stocks: stocks.data
  };
  const submitData: ProductVariantUpdateSubmitData = {
    ...form.data,
    ...getMetadata(form.data, isMetadataModified, isPrivateMetadataModified),
    addStocks,
    attributes: attributes.data,
    attributesWithNewFileValue: attributesWithNewFileValue.data,
    removeStocks: stockDiff.removed,
    updateStocks
  };

  const submit = () => handleFormSubmit(submitData, onSubmit, setChanged);

  return {
    change: handleChange,
    data,
    handlers: {
      addStock: handleStockAdd,
      changeMetadata,
      changeStock: handleStockChange,
      deleteStock: handleStockDelete,
      selectAttribute: handleAttributeChange,
      selectAttributeFile: handleAttributeFileChange,
      selectAttributeMultiple: handleAttributeMultiChange
    },
    hasChanged: changed,
    submit
  };
}

const ProductVariantUpdateForm: React.FC<ProductVariantUpdateFormProps> = ({
  children,
  variant,
  onSubmit,
  ...rest
}) => {
  const props = useProductVariantUpdateForm(variant, onSubmit, rest);

  return <form onSubmit={props.submit}>{children(props)}</form>;
};

ProductVariantUpdateForm.displayName = "ProductVariantUpdateForm";
export default ProductVariantUpdateForm;
