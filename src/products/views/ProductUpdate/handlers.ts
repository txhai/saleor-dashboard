import {
  AttributeValueDelete,
  AttributeValueDeleteVariables
} from "@saleor/attributes/types/AttributeValueDelete";
import {
  FileUpload,
  FileUploadVariables
} from "@saleor/files/types/FileUpload";
import { AttributeErrorFragment } from "@saleor/fragments/types/AttributeErrorFragment";
import { BulkStockErrorFragment } from "@saleor/fragments/types/BulkStockErrorFragment";
import { ProductErrorFragment } from "@saleor/fragments/types/ProductErrorFragment";
import { StockErrorFragment } from "@saleor/fragments/types/StockErrorFragment";
import { UploadErrorFragment } from "@saleor/fragments/types/UploadErrorFragment";
import { decimal, weight } from "@saleor/misc";
import { ProductUpdatePageSubmitData } from "@saleor/products/components/ProductUpdatePage";
import { ProductDetails_product } from "@saleor/products/types/ProductDetails";
import { ProductImageCreateVariables } from "@saleor/products/types/ProductImageCreate";
import { ProductImageReorderVariables } from "@saleor/products/types/ProductImageReorder";
import {
  ProductSetAvailabilityForPurchase,
  ProductSetAvailabilityForPurchaseVariables
} from "@saleor/products/types/ProductSetAvailabilityForPurchase";
import {
  ProductUpdate,
  ProductUpdateVariables
} from "@saleor/products/types/ProductUpdate";
import { ProductVariantCreateData_product } from "@saleor/products/types/ProductVariantCreateData";
import { ProductVariantDetails_productVariant_product } from "@saleor/products/types/ProductVariantDetails";
import { ProductVariantReorderVariables } from "@saleor/products/types/ProductVariantReorder";
import {
  SimpleProductUpdate,
  SimpleProductUpdateVariables
} from "@saleor/products/types/SimpleProductUpdate";
import { mapFormsetStockToStockInput } from "@saleor/products/utils/data";
import { getProductAvailabilityVariables } from "@saleor/products/utils/handlers";
import { ReorderEvent } from "@saleor/types";
import {
  AttributeInputTypeEnum,
  AttributeValueInput
} from "@saleor/types/globalTypes";
import { MutationFetchResult } from "react-apollo";
import { arrayMove } from "react-sortable-hoc";

export function createUpdateHandler(
  product: ProductDetails_product,
  uploadFile: (
    variables: FileUploadVariables
  ) => Promise<MutationFetchResult<FileUpload>>,
  updateProduct: (
    variables: ProductUpdateVariables
  ) => Promise<MutationFetchResult<ProductUpdate>>,
  updateSimpleProduct: (
    variables: SimpleProductUpdateVariables
  ) => Promise<MutationFetchResult<SimpleProductUpdate>>,
  setProductAvailability: (
    variables: ProductSetAvailabilityForPurchaseVariables
  ) => Promise<MutationFetchResult<ProductSetAvailabilityForPurchase>>,
  deleteAttributeValue: (
    variables: AttributeValueDeleteVariables
  ) => Promise<MutationFetchResult<AttributeValueDelete>>
) {
  return async (data: ProductUpdatePageSubmitData) => {
    let errors: Array<
      | ProductErrorFragment
      | StockErrorFragment
      | BulkStockErrorFragment
      | AttributeErrorFragment
      | UploadErrorFragment
    >;

    const attributesWithAddedNewFiles = await data.attributesWithNewFileValue.reduce(
      async (prevUploadPromise, fileAttribute) => {
        // Asynchronously upload file
        const uploadFileResult = await uploadFile({
          file: fileAttribute.value
        });
        // Synchronously gather results
        const attributesWithAddedFiles = await prevUploadPromise;
        errors = [...errors, ...uploadFileResult.data.fileUpload.errors];
        return [
          ...attributesWithAddedFiles,
          {
            file: uploadFileResult.data.fileUpload.url,
            id: fileAttribute.id,
            values: []
          }
        ];
      },
      Promise.resolve<AttributeValueInput[]>([])
    );
    const attributesWithoutAddedNewFiles = data.attributes
      .filter(attribute =>
        data.attributesWithNewFileValue.every(
          attributeWithNewFileValue =>
            attributeWithNewFileValue.id !== attribute.id
        )
      )
      .map(attribute => {
        if (attribute.data.inputType === AttributeInputTypeEnum.FILE) {
          return {
            file: attribute.value[0],
            id: attribute.id,
            values: []
          };
        }
        return {
          file: undefined,
          id: attribute.id,
          values: attribute.value[0] === "" ? [] : attribute.value
        };
      });
    const attributesInput = [
      ...attributesWithoutAddedNewFiles,
      ...attributesWithAddedNewFiles
    ];

    const productVariables: ProductUpdateVariables = {
      id: product.id,
      input: {
        attributes: attributesInput,
        basePrice: decimal(data.basePrice),
        category: data.category,
        chargeTaxes: data.chargeTaxes,
        collections: data.collections,
        descriptionJson: JSON.stringify(data.description),
        isPublished: data.isPublished,
        name: data.name,
        publicationDate:
          data.publicationDate !== "" ? data.publicationDate : null,
        seo: {
          description: data.seoDescription,
          title: data.seoTitle
        },
        slug: data.slug,
        taxCode: data.changeTaxCode ? data.taxCode : null,
        visibleInListings: data.visibleInListings
      }
    };

    if (product.productType.hasVariants) {
      const result = await updateProduct(productVariables);
      errors = result.data.productUpdate.errors;
    } else {
      const result = await updateSimpleProduct({
        ...productVariables,
        addStocks: data.addStocks.map(mapFormsetStockToStockInput),
        deleteStocks: data.removeStocks,
        input: {
          ...productVariables.input,
          weight: weight(data.weight)
        },
        productVariantId: product.variants[0].id,
        productVariantInput: {
          sku: data.sku,
          trackInventory: data.trackInventory
        },
        updateStocks: data.updateStocks.map(mapFormsetStockToStockInput)
      });
      errors = [
        ...result.data.productUpdate.errors,
        ...result.data.productVariantStocksCreate.errors,
        ...result.data.productVariantStocksDelete.errors,
        ...result.data.productVariantStocksUpdate.errors,
        ...result.data.productVariantUpdate.errors
      ];
    }
    const { isAvailableForPurchase, availableForPurchase } = data;
    if (
      isAvailableForPurchase !== product.isAvailableForPurchase ||
      availableForPurchase !== product.availableForPurchase
    ) {
      const variables = getProductAvailabilityVariables({
        availableForPurchase,
        isAvailableForPurchase,
        productId: product.id
      });

      const availabilityResult = await setProductAvailability(variables);
      errors = [
        ...errors,
        ...availabilityResult.data.productSetAvailabilityForPurchase.errors
      ];
    }

    await product.attributes.reduce(
      async (prevDeleteUnusedValuePromise, existingAttribute) => {
        // Asynchronously make calculations
        const fileValueUnused =
          existingAttribute.attribute.inputType ===
            AttributeInputTypeEnum.FILE &&
          existingAttribute.values.length > 0 &&
          data.attributes.find(
            dataAttribute => dataAttribute.id === existingAttribute.attribute.id
          ).value.length === 0;

        if (fileValueUnused) {
          // Asynchronously delete unused attribute values
          const deleteAttributeValueResult = await deleteAttributeValue({
            id: existingAttribute.values[0].id
          });

          // Synchronously gather results
          await prevDeleteUnusedValuePromise;
          errors = [
            ...errors,
            ...deleteAttributeValueResult.data.attributeValueDelete.errors
          ];
        }
      },
      Promise.resolve()
    );

    return errors;
  };
}

export function createImageUploadHandler(
  id: string,
  createProductImage: (variables: ProductImageCreateVariables) => void
) {
  return (file: File) =>
    createProductImage({
      alt: "",
      image: file,
      product: id
    });
}

export function createImageReorderHandler(
  product: ProductDetails_product,
  reorderProductImages: (variables: ProductImageReorderVariables) => void
) {
  return ({ newIndex, oldIndex }: ReorderEvent) => {
    let ids = product.images.map(image => image.id);
    ids = arrayMove(ids, oldIndex, newIndex);
    reorderProductImages({
      imagesIds: ids,
      productId: product.id
    });
  };
}

export function createVariantReorderHandler(
  product:
    | ProductDetails_product
    | ProductVariantDetails_productVariant_product
    | ProductVariantCreateData_product,
  reorderProductVariants: (variables: ProductVariantReorderVariables) => void
) {
  return ({ newIndex, oldIndex }: ReorderEvent) => {
    reorderProductVariants({
      move: {
        id: product.variants[oldIndex].id,
        sortOrder: newIndex - oldIndex
      },
      productId: product.id
    });
  };
}
