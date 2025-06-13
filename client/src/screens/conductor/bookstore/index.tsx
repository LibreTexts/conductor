import { useState } from "react";
import { Icon } from "semantic-ui-react";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { DEMO_PRODUCTS } from "./demo-data";

const collections = [
  {
    name: "Desk and Office",
    description: "Work from home accessories",
    imageSrc:
      "https://tailwindcss.com/plus-assets/img/ecommerce-images/home-page-02-edition-01.jpg",
    imageAlt:
      "Desk with leather desk pad, walnut desk organizer, wireless keyboard and mouse, and porcelain mug.",
    href: "#",
  },
  {
    name: "Self-Improvement",
    description: "Journals and note-taking",
    imageSrc:
      "https://tailwindcss.com/plus-assets/img/ecommerce-images/home-page-02-edition-02.jpg",
    imageAlt:
      "Wood table with porcelain mug, leather journal, brass pen, leather key ring, and a houseplant.",
    href: "#",
  },
  {
    name: "Travel",
    description: "Daily commute essentials",
    imageSrc:
      "https://tailwindcss.com/plus-assets/img/ecommerce-images/home-page-02-edition-03.jpg",
    imageAlt: "Collection of four insulated travel bottles on wooden shelf.",
    href: "#",
  },
];
export default function Example() {
  return (
    <AlternateLayout>
      <main>
        {/* Hero */}
        <div className="flex flex-col border-b border-gray-200 lg:border-0">
          {/* <nav aria-label="Offers" className="order-last lg:order-first">
            <div className="mx-auto max-w-7xl lg:px-8">
              <ul
                role="list"
                className="grid grid-cols-1 divide-y divide-gray-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0"
              >
                {offers.map((offer) => (
                  <li key={offer.name} className="flex flex-col">
                    <a
                      href={offer.href}
                      className="relative flex flex-1 flex-col justify-center bg-white px-4 py-6 text-center focus:z-10"
                    >
                      <p className="text-sm text-gray-500">{offer.name}</p>
                      <p className="font-semibold text-gray-900">
                        {offer.description}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav> */}

          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute hidden h-full w-full bg-gray-100 lg:block"
            />
            <div className="relative bg-gray-100 lg:bg-transparent">
              <div className="mx-auto px-4 sm:px-6 lg:grid lg:grid-cols-2 lg:px-8">
                <div className="mx-auto max-w-2xl py-24 lg:max-w-none lg:py-64">
                  <div className="lg:pr-16">
                    <h1 className="sr-only">LibreTexts Bookstore</h1>
                    <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl xl:text-6xl">
                      Your favorite OER, on your desk
                    </h2>
                    <p className="mt-4 text-xl text-gray-600">
                      Order print copies of textbooks, application access codes,
                      LibreTexts swag, and more.
                    </p>

                    <div className="my-6 flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
                      <a
                        href="/bookstore/catalog?category=books"
                        className="block rounded-md border border-transparent bg-primary px-8 py-3 font-medium text-white hover:shadow-sm hover:text-gray-300"
                      >
                        <Icon name="book" className="inline !mr-3" />
                        Shop Books
                      </a>
                      <a
                        href="/bookstore/catalog?category=access-codes"
                        className="block rounded-md border border-transparent bg-primary px-8 py-3 font-medium text-white hover:shadow-sm sm:ml-4 hover:text-gray-300"
                      >
                        <Icon name="key" className="inline !mr-3" />
                        Shop Access Codes
                      </a>
                      <a
                        href="/bookstore/catalog"
                        className="block rounded-md border border-transparent bg-primary px-8 py-3 font-medium text-white hover:shadow-sm sm:ml-4 hover:text-gray-300"
                      >
                        <Icon name="cart" className="inline !mr-3" />
                        Shop All Items
                      </a>
                    </div>
                    <p className="text-sm text-gray-600">
                      LibreTexts textbooks are{" "}
                      <span className="italic font-semibold">always</span> free
                      to read online. We offer print copies for those who prefer
                      a physical book.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-48 w-full sm:h-64 lg:absolute lg:right-0 lg:top-0 lg:h-full lg:w-1/2">
              <img
                alt=""
                src="/inaki-del-olmo-NIJuEQw0RKg-unsplash.jpg"
                className="size-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Trending products */}
        <section aria-labelledby="trending-heading" className="bg-white">
          <div className="py-16 sm:py-24 lg:mx-32 lg:px-8 lg:py-32">
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-0">
              <h2
                id="trending-heading"
                className="text-2xl font-bold tracking-tight text-gray-900"
              >
                Trending items
              </h2>
              <a
                href="/bookstore/catalog"
                className="hidden text-base font-semibold text-primary sm:block"
              >
                See everything
                <span aria-hidden="true"> &rarr;</span>
              </a>
            </div>

            <div className="relative mt-8">
              <div className="relative w-full overflow-x-auto">
                <ul
                  role="list"
                  className="mx-4 inline-flex space-x-8 sm:mx-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-x-8 lg:space-x-0 gap-y-8"
                >
                  {DEMO_PRODUCTS.map((product) => (
                    <li
                      key={product.id}
                      className="inline-flex w-64 flex-col text-center lg:w-auto border rounded-md p-4 shadow-sm"
                    >
                      <div className="group relative">
                        <div className="flex justify-center">
                          <img
                            alt={product.imageAlt}
                            src={product.imageSrc}
                            className="aspect-auto h-64 w-fit rounded-md bg-gray-white object-contain group-hover:opacity-75"
                          />
                        </div>
                        <div className="mt-6">
                          <h3 className="mt-1 text-xl font-semibold text-gray-900">
                            <a href={`/bookstore/product/${product.id}`}>
                              <span className="absolute inset-0" />
                              {product.name}
                            </a>
                          </h3>
                          <p className="text-base text-gray-500 mt-4">
                            {product.subtitle}
                          </p>
                          <p className="mt-4 text-lg text-gray-900">
                            {product.price}
                          </p>
                        </div>
                      </div>

                      {/* <h4 className="sr-only">Available colors</h4>
                      <ul
                        role="list"
                        className="mt-auto flex items-center justify-center space-x-3 pt-6"
                      >
                        {product.availableColors.map((color) => (
                          <li
                            key={color.name}
                            style={{ backgroundColor: color.colorBg }}
                            className="size-4 rounded-full border border-black/10"
                          >
                            <span className="sr-only">{color.name}</span>
                          </li>
                        ))}
                      </ul> */}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-12 px-4 sm:hidden">
              <a
                href="/bookstore/catalog"
                className="text-sm font-semibold text-primary "
              >
                See everything
                <span aria-hidden="true"> &rarr;</span>
              </a>
            </div>
          </div>
        </section>

        {/* Collections */}
        {/* <section aria-labelledby="collections-heading" className="bg-gray-100">
          <div className="mx-32 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl py-16 sm:py-24 lg:max-w-none lg:py-32">
              <h2
                id="collections-heading"
                className="text-2xl font-bold text-gray-900"
              >
                Collections
              </h2>

              <div className="mt-6 space-y-12 lg:grid lg:grid-cols-3 lg:gap-x-6 lg:space-y-0">
                {collections.map((collection) => (
                  <div key={collection.name} className="group relative">
                    <img
                      alt={collection.imageAlt}
                      src={collection.imageSrc}
                      className="w-full rounded-lg bg-white object-cover group-hover:opacity-75 max-sm:h-80 sm:aspect-[2/1] lg:aspect-square"
                    />
                    <h3 className="mt-6 text-sm text-gray-500">
                      <a href={collection.href}>
                        <span className="absolute inset-0" />
                        {collection.name}
                      </a>
                    </h3>
                    <p className="text-base font-semibold text-gray-900">
                      {collection.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section> */}
      </main>
    </AlternateLayout>
  );
}
