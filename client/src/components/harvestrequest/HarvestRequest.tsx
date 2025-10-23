import DefaultLayout from "../navigation/AlternateLayout.js";
import { IconChevronRight, IconHelpCircleFilled } from "@tabler/icons-react";

const HarvestRequest = () => {
  return (
    <DefaultLayout
      altBackground
      h="screen-content"
      className="flex flex-col justify-center items-center"
    >
      <div className="flex flex-col w-full h-full overflow-y-auto items-center justify-center">
        <div className="flex flex-col border rounded-lg m-4 p-8 lg:w-1/2 shadow-lg bg-white text-center">
          <h1 className="text-4xl font-semibold mb-4">
            Harvesting Requests Have Moved!
          </h1>
          <p className="mb-10 text-lg">
            To better serve our users, we have integrated the harvesting request
            process into our Support Center to centralize requests and improve
            communication.
          </p>
          <ul
            role="list"
            className="divide-y divide-gray-200 overflow-hidden bg-white shadow-xs outline-1 outline-gray-900/5 sm:rounded-xl"
            aria-label="Support Queues"
          >
            <a
              href="https://commons.libretexts.org/support/contact?queue=harvesting"
              rel="noopener noreferrer"
              className="contents"
            >
              <li
                role="link"
                className="relative flex justify-between gap-x-6 px-4 py-5 bg-gray-50 hover:bg-gray-100 sm:px-6 cursor-pointer"
              >
                <div className="flex min-w-0 gap-x-4 items-center">
                  <IconHelpCircleFilled
                    className="!size-12 flex-none text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-auto text-left">
                    <p className="text-xl font-semibold text-gray-900">
                      Go to Support Center
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-x-4">
                  <IconChevronRight
                    aria-hidden="true"
                    className="size-8 flex-none text-gray-600"
                  />
                </div>
              </li>
            </a>
          </ul>
        </div>
      </div>
    </DefaultLayout>
  );
};

export default HarvestRequest;
