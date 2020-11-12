import Form from "@saleor/components/Form";
import { countries } from "@saleor/fixtures";
import CardDecorator from "@saleor/storybook/CardDecorator";
import Decorator from "@saleor/storybook/Decorator";
import { ChoiceProvider } from "@saleor/storybook/mock";
import createSingleAutocompleteSelectHandler from "@saleor/utils/handlers/singleAutocompleteSelectChangeHandler";
import { storiesOf } from "@storybook/react";
import React from "react";

import FileUploadField, { FileUploadFieldProps } from "./FileUploadField";

const suggestions = countries.map(c => ({ label: c.name, value: c.code }));

const props: FileUploadFieldProps = {
  choices: undefined,
  displayValue: undefined,
  label: "Country",
  loading: false,
  name: "country",
  onChange: () => undefined,
  placeholder: "Select country",
  value: suggestions[0].value
};

const Story: React.FC<Partial<
  FileUploadFieldProps & {
    enableLoadMore: boolean;
  }
>> = ({ allowCustomValues, emptyOption, enableLoadMore }) => {
  const [displayValue, setDisplayValue] = React.useState(suggestions[0].label);

  return (
    <Form initial={{ country: suggestions[0].value }}>
      {({ change, data }) => (
        <ChoiceProvider choices={suggestions}>
          {({ choices, fetchChoices, onFetchMore, hasMore, loading }) => {
            const handleSelect = createSingleAutocompleteSelectHandler(
              change,
              setDisplayValue,
              choices
            );

            return (
              <FileUploadField
                {...props}
                displayValue={displayValue}
                choices={choices}
                fetchChoices={fetchChoices}
                helperText={`Value: ${data.country}`}
                loading={loading}
                onChange={handleSelect}
                value={data.country}
                hasMore={enableLoadMore ? hasMore : false}
                onFetchMore={enableLoadMore ? onFetchMore : undefined}
                allowCustomValues={allowCustomValues}
                emptyOption={emptyOption}
              />
            );
          }}
        </ChoiceProvider>
      )}
    </Form>
  );
};

const contentProps: FileUploadFieldContentProps = {
  add: undefined,
  choices: suggestions.slice(0, 10),
  displayCustomValue: false,
  emptyOption: false,
  getItemProps: () => undefined,
  hasMore: false,
  highlightedIndex: 0,
  inputValue: suggestions[0].label,
  isCustomValueSelected: false,
  loading: false,
  onFetchMore: () => undefined,
  selectedItem: suggestions[0].value
};

storiesOf("Generics / Select with autocomplete", module)
  .addDecorator(CardDecorator)
  .addDecorator(Decorator)
  .add("default", () => <FileUploadFieldContent {...contentProps} />)
  .add("with add", () => (
    <FileUploadFieldContent
      {...contentProps}
      add={{
        label: "Add New Collection",
        onClick: () => undefined
      }}
    />
  ))
  .add("can load more", () => (
    <FileUploadFieldContent {...contentProps} hasMore={true} />
  ))
  .add("no data", () => (
    <FileUploadFieldContent {...contentProps} choices={[]} />
  ))
  .add("interactive", () => <Story />)
  .add("interactive with custom option", () => (
    <Story allowCustomValues={true} />
  ))
  .add("interactive with empty option", () => <Story emptyOption={true} />)
  .add("interactive with load more", () => <Story enableLoadMore={true} />);
