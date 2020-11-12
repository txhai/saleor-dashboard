import { OutputData } from "@editorjs/editorjs";
import { attribute } from "@saleor/attributes/fixtures";
import { AttributeInput } from "@saleor/components/Attributes";
import { MetadataFormData } from "@saleor/components/Metadata";
import { MultiAutocompleteChoiceType } from "@saleor/components/MultiAutocompleteSelectField";
import { RichTextEditorChange } from "@saleor/components/RichTextEditor";
import { SingleAutocompleteChoiceType } from "@saleor/components/SingleAutocompleteSelectField";
import useForm, { FormChange, SubmitPromise } from "@saleor/hooks/useForm";
import useFormset, {
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
export interface FileAttributeInput {
  attributeId: string;
  file: File;
}
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
  addFileAttributes: FileAttributeInput[];
  removeFileAttributeValues: AttributeInput[];
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
    Record<"addAttributeFile", FormsetChange<File>>,
    Record<
      "deleteAttributeFile" | "addStock" | "deleteStock",
      (id: string) => void
    > {
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

const getAttributesData = (
  attributes: AttributeInput[],
  addFileAttributes: FileAttributeInput[],
  removeFileAttributes: AttributeInput[]
) => {
  const addFileAttributesInput: AttributeInput[] = addFileAttributes.map(
    fileAttribute => {
      const attribute = attributes.find(
        attribute => attribute.id === fileAttribute.attributeId
      );
      return {
        ...attribute,
        data: {
          ...attribute.data,
          values: [
            {
              __typename: "AttributeValue",
              id: undefined,
              name: fileAttribute.file.name,
              slug: undefined
            }
          ]
        }
      };
    }
  );
  const restAttributees = attributes
    .filter(attribute =>
      addFileAttributes.every(
        fileAttribute => fileAttribute.attributeId !== attribute.id
      )
    )
    .map(attribute => {
      const valueRemoved = removeFileAttributes.some(
        fileAttribute => fileAttribute.id === attribute.id
      );
      return valueRemoved
        ? { ...attribute, data: { ...attribute.data, values: [] } }
        : attribute;
    });

  return [...restAttributees, ...addFileAttributesInput];
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
  const stocks = useFormset(getStockInputFromProduct(product));
  const [description, changeDescription] = useRichText({
    initial: product?.descriptionJson,
    triggerChange
  });
  const [addFileAttributes, setAddFileAttributes] = React.useState<
    FileAttributeInput[]
  >([]);
  const [
    removeFileAttributeValues,
    setRemoveFileAttributeValues
  ] = React.useState<AttributeInput[]>([]);

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
  const handleAttributeFileAdd = (attributeId: string, file: File) => {
    setAddFileAttributes([...addFileAttributes, { attributeId, file }]);
    triggerChange();
  };
  const handleAttributeFileDelete = (attributeId: string) => {
    const removeingQueuedInAdded = addFileAttributes.findIndex(
      attribute => attribute.attributeId === attributeId
    );
    if (removeingQueuedInAdded >= 0) {
      setAddFileAttributes(
        removeAtIndex(addFileAttributes, removeingQueuedInAdded)
      );
    } else {
      setRemoveFileAttributeValues([
        ...removeFileAttributeValues,
        attributes.get(attributeId)
      ]);
    }
    triggerChange();
  };
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
    attributes: getAttributesData(
      attributes.data,
      addFileAttributes,
      removeFileAttributeValues
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
    addFileAttributes,
    addStocks: [],
    attributes: attributes.data,
    description: description.current,
    removeFileAttributeValues
  });

  const submit = async () =>
    handleFormSubmit(getSubmitData(), onSubmit, setChanged);

  return {
    change: handleChange,
    data,
    handlers: {
      addAttributeFile: handleAttributeFileAdd,
      addStock: handleStockAdd,
      changeDescription,
      changeMetadata,
      changeStock: handleStockChange,
      deleteAttributeFile: handleAttributeFileDelete,
      deleteStock: handleStockDelete,
      selectAttribute: handleAttributeChange,
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
