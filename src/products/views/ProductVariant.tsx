import placeholderImg from "@assets/images/placeholder255x255.png";
import { useAttributeValueDeleteMutation } from "@saleor/attributes/mutations";
import NotFoundPage from "@saleor/components/NotFoundPage";
import { WindowTitle } from "@saleor/components/WindowTitle";
import { useFileUploadMutation } from "@saleor/files/mutations";
import { AttributeErrorFragment } from "@saleor/fragments/types/AttributeErrorFragment";
import { UploadErrorFragment } from "@saleor/fragments/types/UploadErrorFragment";
import useNavigator from "@saleor/hooks/useNavigator";
import useNotifier from "@saleor/hooks/useNotifier";
import useOnSetDefaultVariant from "@saleor/hooks/useOnSetDefaultVariant";
import useShop from "@saleor/hooks/useShop";
import { commonMessages } from "@saleor/intl";
import {
  AttributeInputTypeEnum,
  AttributeValueInput
} from "@saleor/types/globalTypes";
import createDialogActionHandlers from "@saleor/utils/handlers/dialogActionHandlers";
import createMetadataUpdateHandler from "@saleor/utils/handlers/metadataUpdateHandler";
import {
  useMetadataUpdate,
  usePrivateMetadataUpdate
} from "@saleor/utils/metadata/updateMetadata";
import { useWarehouseList } from "@saleor/warehouses/queries";
import { warehouseAddPath } from "@saleor/warehouses/urls";
import React, { useEffect, useState } from "react";
import { useIntl } from "react-intl";

import { decimal, weight } from "../../misc";
import ProductVariantDeleteDialog from "../components/ProductVariantDeleteDialog";
import ProductVariantPage, {
  ProductVariantPageSubmitData
} from "../components/ProductVariantPage";
import {
  useProductVariantReorderMutation,
  useVariantDeleteMutation,
  useVariantImageAssignMutation,
  useVariantImageUnassignMutation,
  useVariantUpdateMutation
} from "../mutations";
import { useProductVariantQuery } from "../queries";
import { VariantUpdate_productVariantUpdate_errors } from "../types/VariantUpdate";
import {
  productUrl,
  productVariantAddUrl,
  productVariantEditUrl,
  ProductVariantEditUrlDialog,
  ProductVariantEditUrlQueryParams
} from "../urls";
import { mapFormsetStockToStockInput } from "../utils/data";
import { createVariantReorderHandler } from "./ProductUpdate/handlers";

interface ProductUpdateProps {
  variantId: string;
  productId: string;
  params: ProductVariantEditUrlQueryParams;
}

export const ProductVariant: React.FC<ProductUpdateProps> = ({
  variantId,
  productId,
  params
}) => {
  const shop = useShop();
  const navigate = useNavigator();
  const notify = useNotifier();
  const intl = useIntl();
  const [errors, setErrors] = useState<
    VariantUpdate_productVariantUpdate_errors[]
  >([]);
  useEffect(() => {
    setErrors([]);
  }, [variantId]);

  const warehouses = useWarehouseList({
    displayLoader: true,
    variables: {
      first: 50
    }
  });

  const { data, loading } = useProductVariantQuery({
    displayLoader: true,
    variables: {
      id: variantId
    }
  });
  const [updateMetadata] = useMetadataUpdate({});
  const [updatePrivateMetadata] = usePrivateMetadataUpdate({});

  const [openModal] = createDialogActionHandlers<
    ProductVariantEditUrlDialog,
    ProductVariantEditUrlQueryParams
  >(
    navigate,
    params => productVariantEditUrl(productId, variantId, params),
    params
  );

  const handleBack = () => navigate(productUrl(productId));

  const [uploadFile, uploadFileOpts] = useFileUploadMutation({});

  const [
    deleteAttributeValue,
    deleteAttributeValueOpts
  ] = useAttributeValueDeleteMutation({});

  const [assignImage, assignImageOpts] = useVariantImageAssignMutation({});
  const [unassignImage, unassignImageOpts] = useVariantImageUnassignMutation(
    {}
  );
  const [deleteVariant, deleteVariantOpts] = useVariantDeleteMutation({
    onCompleted: () => {
      notify({
        status: "success",
        text: intl.formatMessage({
          defaultMessage: "Variant removed"
        })
      });
      navigate(productUrl(productId));
    }
  });
  const [updateVariant, updateVariantOpts] = useVariantUpdateMutation({
    onCompleted: data => {
      if (data.productVariantUpdate.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(commonMessages.savedChanges)
        });
      }
      setErrors(data.productVariantUpdate.errors);
    }
  });

  const variant = data?.productVariant;

  if (variant === null) {
    return <NotFoundPage onBack={handleBack} />;
  }

  const [
    reorderProductVariants,
    reorderProductVariantsOpts
  ] = useProductVariantReorderMutation({});

  const onSetDefaultVariant = useOnSetDefaultVariant(productId, variant);

  const handleVariantReorder = createVariantReorderHandler(
    variant?.product,
    variables => reorderProductVariants({ variables })
  );

  const disableFormSave =
    loading ||
    uploadFileOpts.loading ||
    deleteVariantOpts.loading ||
    updateVariantOpts.loading ||
    assignImageOpts.loading ||
    unassignImageOpts.loading ||
    reorderProductVariantsOpts.loading ||
    deleteAttributeValueOpts.loading;

  const handleImageSelect = (id: string) => () => {
    if (variant) {
      if (variant?.images?.map(image => image.id).indexOf(id) !== -1) {
        unassignImage({
          variables: {
            imageId: id,
            variantId: variant.id
          }
        });
      } else {
        assignImage({
          variables: {
            imageId: id,
            variantId: variant.id
          }
        });
      }
    }
  };

  const handleUpdate = async (data: ProductVariantPageSubmitData) => {
    let submitErrors: Array<AttributeErrorFragment | UploadErrorFragment>;

    const attributesWithAddedNewFiles = await data.attributesWithNewFileValue.reduce(
      async (prevUploadPromise, fileAttribute) => {
        // Asynchronously upload file
        const uploadFileResult = await uploadFile({
          variables: {
            file: fileAttribute.value
          }
        });
        // Synchronously gather results
        const attributesWithAddedFiles = await prevUploadPromise;
        submitErrors = [
          ...submitErrors,
          ...uploadFileResult.data.fileUpload.errors
        ];
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

    const result = await updateVariant({
      variables: {
        addStocks: data.addStocks.map(mapFormsetStockToStockInput),
        attributes: attributesInput,
        costPrice: decimal(data.costPrice),
        id: variantId,
        price: decimal(data.price),
        removeStocks: data.removeStocks,
        sku: data.sku,
        stocks: data.updateStocks.map(mapFormsetStockToStockInput),
        trackInventory: data.trackInventory,
        weight: weight(data.weight)
      }
    });

    await variant.attributes.reduce(
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
            variables: {
              id: existingAttribute.values[0].id
            }
          });

          // Synchronously gather results
          await prevDeleteUnusedValuePromise;
          submitErrors = [
            ...submitErrors,
            ...deleteAttributeValueResult.data.attributeValueDelete.errors
          ];
        }
      },
      Promise.resolve()
    );

    return [
      ...submitErrors,
      ...result.data?.productVariantStocksCreate.errors,
      ...result.data?.productVariantStocksDelete.errors,
      ...result.data?.productVariantStocksUpdate.errors,
      ...result.data?.productVariantUpdate.errors
    ];
  };
  const handleSubmit = createMetadataUpdateHandler(
    data?.productVariant,
    handleUpdate,
    variables => updateMetadata({ variables }),
    variables => updatePrivateMetadata({ variables })
  );

  return (
    <>
      <WindowTitle title={data?.productVariant?.name} />
      <ProductVariantPage
        defaultWeightUnit={shop?.defaultWeightUnit}
        defaultVariantId={data?.productVariant.product.defaultVariant?.id}
        errors={errors}
        onSetDefaultVariant={onSetDefaultVariant}
        saveButtonBarState={updateVariantOpts.status}
        loading={disableFormSave}
        placeholderImage={placeholderImg}
        variant={variant}
        header={variant?.name || variant?.sku}
        warehouses={
          warehouses.data?.warehouses.edges.map(edge => edge.node) || []
        }
        onAdd={() => navigate(productVariantAddUrl(productId))}
        onBack={handleBack}
        onDelete={() => openModal("remove")}
        onImageSelect={handleImageSelect}
        onSubmit={handleSubmit}
        onWarehouseConfigure={() => navigate(warehouseAddPath)}
        onVariantClick={variantId => {
          navigate(productVariantEditUrl(productId, variantId));
        }}
        onVariantReorder={handleVariantReorder}
      />
      <ProductVariantDeleteDialog
        confirmButtonState={deleteVariantOpts.status}
        onClose={() => navigate(productVariantEditUrl(productId, variantId))}
        onConfirm={() =>
          deleteVariant({
            variables: {
              id: variantId
            }
          })
        }
        open={params.action === "remove"}
        name={data?.productVariant?.name}
      />
    </>
  );
};
export default ProductVariant;
