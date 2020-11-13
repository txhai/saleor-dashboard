import { OutputData } from "@editorjs/editorjs";
import { attribute } from "@saleor/attributes/fixtures";
import {
  AttributeFileInput,
  AttributeInput
} from "@saleor/components/Attributes";
import { MetadataFormData } from "@saleor/components/Metadata";
import { MultiAutocompleteChoiceType } from "@saleor/components/MultiAutocompleteSelectField";
import { RichTextEditorChange } from "@saleor/components/RichTextEditor";
import { SingleAutocompleteChoiceType } from "@saleor/components/SingleAutocompleteSelectField";
import { AttributeValueFragment } from "@saleor/fragments/types/AttributeValueFragment";
import useForm, { FormChange, SubmitPromise } from "@saleor/hooks/useForm";
import useFormset, {
  FormsetAtomicData,
  FormsetChange,
  FormsetData
} from "@saleor/hooks/useFormset";
import { ProductDetails_product } from "@saleor/products/types/ProductDetails";
import {
  getAttributeInputFromProduct,
  getProductUpdatePageFormData,
  getStockInputFromProduct
} from "@saleor/products/utils/data";
import {
  createAttributeChangeHandler,
  createAttributeFileChangeHandler,
  createAttributeMultiChangeHandler
} from "@saleor/products/utils/handlers";
import { SearchWarehouses_search_edges_node } from "@saleor/searches/types/SearchWarehouses";
import {
  AttributeInputTypeEnum,
  AttributeValueInput
} from "@saleor/types/globalTypes";
import handleFormSubmit from "@saleor/utils/handlers/handleFormSubmit";
import createMultiAutocompleteSelectHandler from "@saleor/utils/handlers/multiAutocompleteSelectChangeHandler";
import createSingleAutocompleteSelectHandler from "@saleor/utils/handlers/singleAutocompleteSelectChangeHandler";
import { removeAtIndex } from "@saleor/utils/lists";
import getMetadata from "@saleor/utils/metadata/getMetadata";
import useMetadataChangeTrigger from "@saleor/utils/metadata/useMetadataChangeTrigger";
import useRichText from "@saleor/utils/richText/useRichText";
import { diff } from "fast-array-diff";
import React from "react";

import { ProductStockInput } from "../ProductStocks";

export interface ProductUpdateFormData extends MetadataFormData {
  availableForPurchase: string;
  basePrice: number;
  category: string | null;
  changeTaxCode: boolean;
  chargeTaxes: boolean;
  collections: string[];
  isAvailable: boolean;
  isAvailableForPurchase: boolean;
  isPublished: boolean;
  name: string;
  slug: string;
  publicationDate: string;
  seoDescription: string;
  seoTitle: string;
  sku: string;
  taxCode: string;
  trackInventory: boolean;
  visibleInListings: boolean;
  weight: string;
}
export interface FileAttributeInputData {
  attributeId: string;
  file: File;
}
export type FileAttributeInput = FormsetAtomicData<
  FileAttributeInputData,
  string[]
>;

export interface FileAttributesSubmitData {
  fileAttributes: FileAttributeInput[];
}
export interface ProductUpdateData extends ProductUpdateFormData {
  attributes: AttributeInput[];
  description: OutputData;
  stocks: ProductStockInput[];
}
export interface ProductUpdateSubmitData extends ProductUpdateFormData {
  attributes: AttributeInput[];
  attributesWithNewFileValue: FormsetData<null, File>;
  collections: string[];
  description: OutputData;
  addStocks: ProductStockInput[];
  updateStocks: ProductStockInput[];
  removeStocks: string[];
}

interface ProductUpdateHandlers
  extends Record<
      | "changeMetadata"
      | "selectCategory"
      | "selectCollection"
      | "selectTaxRate",
      FormChange
    >,
    Record<
      "changeStock" | "selectAttribute" | "selectAttributeMultiple",
      FormsetChange<string>
    >,
    Record<"selectAttributeFile", FormsetChange<File>>,
    Record<"addStock" | "deleteStock", (id: string) => void> {
  changeDescription: RichTextEditorChange;
}
export interface UseProductUpdateFormResult {
  change: FormChange;

  data: ProductUpdateData;
  handlers: ProductUpdateHandlers;
  hasChanged: boolean;
  submit: () => Promise<boolean>;
}

export interface UseProductUpdateFormOpts
  extends Record<
    "categories" | "collections" | "taxTypes",
    SingleAutocompleteChoiceType[]
  > {
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  setSelectedCollections: React.Dispatch<
    React.SetStateAction<MultiAutocompleteChoiceType[]>
  >;
  setSelectedTaxType: React.Dispatch<React.SetStateAction<string>>;
  selectedCollections: MultiAutocompleteChoiceType[];
  warehouses: SearchWarehouses_search_edges_node[];
}

export interface ProductUpdateFormProps extends UseProductUpdateFormOpts {
  children: (props: UseProductUpdateFormResult) => React.ReactNode;
  product: ProductDetails_product;
  onSubmit: (data: ProductUpdateSubmitData) => SubmitPromise;
}

const getAvailabilityData = ({
  availableForPurchase,
  isAvailableForPurchase,
  isPublished,
  publicationDate
}: ProductUpdateFormData) => ({
  isAvailableForPurchase: isAvailableForPurchase || !!availableForPurchase,
  isPublished: isPublished || !!publicationDate
});

const getStocksData = (
  product: ProductDetails_product,
  stocks: FormsetData<null, string>
) => {
  if (product?.productType?.hasVariants) {
    return { addStocks: [], removeStocks: [], updateStocks: [] };
  }

  const dataStocks = stocks.map(stock => stock.id);
  const variantStocks =
    product?.variants[0]?.stocks.map(stock => stock.warehouse.id) || [];
  const stockDiff = diff(variantStocks, dataStocks);

  return {
    addStocks: stocks.filter(stock =>
      stockDiff.added.some(addedStock => addedStock === stock.id)
    ),
    removeStocks: stockDiff.removed,
    updateStocks: stocks.filter(
      stock => !stockDiff.added.some(addedStock => addedStock === stock.id)
    )
  };
};

const getAttributesDisplayData = (
  attributes: AttributeInput[],
  attributesWithNewFileValue: FormsetData<null, File>
) => {
  const attributesWithNewFileValueInput: AttributeInput[] = attributesWithNewFileValue.map(
    fileAttribute => {
      const attribute = attributes.find(
        attribute => attribute.id === fileAttribute.id
      );
      return {
        ...attribute,
        data: {
          ...attribute.data,
          values: [
            {
              __typename: "AttributeValue",
              file: {
                __typename: "File",
                contentType: fileAttribute.value.type,
                url: undefined
              },
              id: undefined,
              name: fileAttribute.value.name,
              slug: undefined
            }
          ]
        }
      };
    }
  );
  const attributesWithoutNewFileValueInput = attributes.filter(attribute =>
    attributesWithNewFileValue.every(
      attributeWithNewFileValue => attributeWithNewFileValue.id !== attribute.id
    )
  );

  return [
    ...attributesWithoutNewFileValueInput,
    ...attributesWithNewFileValueInput
  ];
};

function useProductUpdateForm(
  product: ProductDetails_product,
  onSubmit: (data: ProductUpdateSubmitData) => SubmitPromise,
  opts: UseProductUpdateFormOpts
): UseProductUpdateFormResult {
  const [changed, setChanged] = React.useState(false);
  const triggerChange = () => setChanged(true);

  const form = useForm(
    getProductUpdatePageFormData(product, product?.variants)
  );
  const attributes = useFormset(getAttributeInputFromProduct(product));
  const attributesWithNewFileValue = useFormset<null, File>([]);
  const stocks = useFormset(getStockInputFromProduct(product));
  const [description, changeDescription] = useRichText({
    initial: product?.descriptionJson,
    triggerChange
  });

  const {
    isMetadataModified,
    isPrivateMetadataModified,
    makeChangeHandler: makeMetadataChangeHandler
  } = useMetadataChangeTrigger();

  const handleChange: FormChange = (event, cb) => {
    form.change(event, cb);
    triggerChange();
  };
  const handleCollectionSelect = createMultiAutocompleteSelectHandler(
    form.toggleValue,
    opts.setSelectedCollections,
    opts.selectedCollections,
    opts.collections
  );
  const handleCategorySelect = createSingleAutocompleteSelectHandler(
    handleChange,
    opts.setSelectedCategory,
    opts.categories
  );
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
  const handleStockChange: FormsetChange<string> = (id, value) => {
    triggerChange();
    stocks.change(id, value);
  };
  const handleStockAdd = (id: string) => {
    triggerChange();
    stocks.add({
      data: null,
      id,
      label: opts.warehouses.find(warehouse => warehouse.id === id).name,
      value: "0"
    });
  };
  const handleStockDelete = (id: string) => {
    triggerChange();
    stocks.remove(id);
  };
  const handleTaxTypeSelect = createSingleAutocompleteSelectHandler(
    handleChange,
    opts.setSelectedTaxType,
    opts.taxTypes
  );
  const changeMetadata = makeMetadataChangeHandler(handleChange);

  const data: ProductUpdateData = {
    ...form.data,
    attributes: getAttributesDisplayData(
      attributes.data,
      attributesWithNewFileValue.data
    ),
    description: description.current,
    stocks: stocks.data
  };
  // Need to make it function to always have description.current up to date
  const getSubmitData = (): ProductUpdateSubmitData => ({
    ...data,
    ...getAvailabilityData(data),
    ...getStocksData(product, stocks.data),
    ...getMetadata(data, isMetadataModified, isPrivateMetadataModified),
    addStocks: [],
    attributes: attributes.data,
    attributesWithNewFileValue: attributesWithNewFileValue.data,
    description: description.current
  });

  const submit = async () =>
    handleFormSubmit(getSubmitData(), onSubmit, setChanged);

  return {
    change: handleChange,
    data,
    handlers: {
      addStock: handleStockAdd,
      changeDescription,
      changeMetadata,
      changeStock: handleStockChange,
      deleteStock: handleStockDelete,
      selectAttribute: handleAttributeChange,
      selectAttributeFile: handleAttributeFileChange,
      selectAttributeMultiple: handleAttributeMultiChange,
      selectCategory: handleCategorySelect,
      selectCollection: handleCollectionSelect,
      selectTaxRate: handleTaxTypeSelect
    },
    hasChanged: changed,
    submit
  };
}

const ProductUpdateForm: React.FC<ProductUpdateFormProps> = ({
  children,
  product,
  onSubmit,
  ...rest
}) => {
  const props = useProductUpdateForm(product, onSubmit, rest);

  return <form onSubmit={props.submit}>{children(props)}</form>;
};

ProductUpdateForm.displayName = "ProductUpdateForm";
export default ProductUpdateForm;
