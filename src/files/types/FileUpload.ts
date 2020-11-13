/* tslint:disable */
/* eslint-disable */
// This file was automatically generated and should not be edited.

import { UploadErrorCode } from "./../../types/globalTypes";

// ====================================================
// GraphQL mutation operation: FileUpload
// ====================================================

export interface FileUpload_fileUpload_errors {
  __typename: "UploadError";
  code: UploadErrorCode;
  field: string | null;
}

export interface FileUpload_fileUpload {
  __typename: "FileUpload";
  url: string;
  contentType: string;
  errors: FileUpload_fileUpload_errors[];
}

export interface FileUpload {
  fileUpload: FileUpload_fileUpload;
}

export interface FileUploadVariables {
  file: File;
}
