import React, { useState } from "react";
import { Form } from "semantic-ui-react";
import "./index.css"
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";
import KBSearchForm from "../KBSearchForm";

const KBJumbotron: React.FC<{}> = ({ }) => {
  const { handleGlobalError } = useGlobalError();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    try {
      if (!search) return;
      setLoading(true);
      // const res = await axios.get('/kb/search', {
      //   params: {
      //     query: search
      //   }
      // })

      // if(res.data.err){
      //   throw new Error(res.data.err)
      // }

      // if(!res.data.pages || !Array.isArray(res.data.pages)) {
      //   throw new Error("Invalid response from server")
      // }

      // console.log(res.data.pages)
      window.location.href = `/kb/search?query=${encodeURIComponent(search)}`;
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      id="kb-jumbotron"
      className="z-50 h-80 flex flex-col items-center justify-center bg-primary"
    >
      <h1 className="text-5xl text-white font-bold">Knowledge Base</h1>
      <p className="text-white text-xl mt-2">
        Search the Knowledge Base for help with all of your LibreTexts
        apps & services.
      </p>
      <div className="mt-8 w-full">
        <KBSearchForm />
      </div>
      <a className="mt-4 text-white text-sm underline" href="/kb/welcome">View All Content</a>
      <div className="typewriter mt-8 italic opacity-75">
        <p>All of your LibreTexts questions, answered.</p>
      </div>
    </div>
  );
};

export default KBJumbotron;
