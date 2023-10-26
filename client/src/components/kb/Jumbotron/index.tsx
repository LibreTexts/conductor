import React, { useState } from "react";
import { Form } from "semantic-ui-react";

const KBJumbotron: React.FC<{}> = ({}) => {
  const [search, setSearch] = useState("");
  async function handleSearch() {
    console.log("searching...");
  }

  return (
    <div
      id="kb-jumbotron"
      className="z-50 h-80 flex flex-col items-center justify-center bg-primary"
    >
      <h1 className="text-5xl text-white font-bold">Knowledge Base</h1>
      <p className="text-white text-xl mt-2">
        Search the Knowledge Base for help with all of your LibreTexts
        questions.
      </p>
      <Form
        className="mt-8 w-full flex justify-center"
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <Form.Input
          id="kb-search"
          icon="search"
          placeholder="Search the Knowledge Base..."
          className="w-3/4"
          value={search}
        />
      </Form>
    </div>
  );
};

export default KBJumbotron;
