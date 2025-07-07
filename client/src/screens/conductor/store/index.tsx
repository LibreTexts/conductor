import { useQuery } from "@tanstack/react-query";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import {
  IconBook2,
  IconKey,
  IconSchool,
  IconShirt,
  IconShoppingCart,
} from "@tabler/icons-react";
import { StoreProduct } from "../../../types";
import api from "../../../api";
import LoadingSpinner from "../../../components/LoadingSpinner";
import TruncatedText from "../../../components/util/TruncatedText";
import { formatPrice } from "../../../utils/storeHelpers";

const CategoryLink = ({
  href,
  children,
  target,
}: {
  href: string;
  children: React.ReactNode;
  target?: "_blank";
}) => (
  <a
    href={href}
    target={target}
    className="flex items-center justify-center rounded-md border border-transparent bg-primary px-6 py-3 font-medium text-white hover:shadow-sm hover:text-gray-300 min-h-[3rem] text-center"
    style={{
      fontSize: "clamp(0.75rem, 2.5vw, 1rem)",
      lineHeight: "1.2",
    }}
  >
    {children}
  </a>
);

export default function StoreHome() {
  const { data, isLoading } = useQuery<StoreProduct[]>({
    queryKey: ["store-most-popular-products"],
    queryFn: async () => {
      const res = await api.getMostPopularStoreProducts({
        limit: 10,
      });
      return res.data.products;
    },
    refetchOnWindowFocus: false,
  });

  return (
    <AlternateLayout>
      <main>
        <div className="flex flex-col border-b border-gray-200 lg:border-0">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute hidden h-full w-full bg-gray-100 lg:block"
            />
            <div className="relative bg-gray-100 lg:bg-transparent">
              <div className="mx-auto px-4 sm:px-6 lg:grid lg:grid-cols-2 lg:px-8">
                <div className="mx-auto max-w-2xl py-24 lg:max-w-none lg:py-64">
                  <div className="lg:pr-16">
                    <h1 className="sr-only">LibreTexts Store</h1>
                    <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl xl:text-6xl">
                      Your favorite OER, on your desk
                    </h2>
                    <p className="mt-4 text-xl text-gray-600">
                      Order print copies of textbooks, application access codes,
                      LibreTexts swag, and more.
                    </p>

                    <div className="my-6 grid grid-cols-1 gap-y-4 sm:grid-cols-3 sm:gap-x-4">
                      <CategoryLink href="/store/catalog?category=books">
                        <IconBook2 className="inline !mr-3" />
                        Shop Books
                      </CategoryLink>
                      <CategoryLink href="/store/catalog?category=access-codes">
                        <IconKey className="inline !mr-3" />
                        Shop Access Codes
                      </CategoryLink>
                      <CategoryLink href="/store/catalog?category=academy">
                        <IconSchool className="inline !mr-3" />
                        Shop Prof. Dev.
                      </CategoryLink>
                      <CategoryLink
                        href="https://swagstore.libretexts.org"
                        target="_blank"
                      >
                        <IconShirt className="inline !mr-3" />
                        Shop Merch
                      </CategoryLink>
                      <CategoryLink href="/store/catalog">
                        <IconShoppingCart className="inline !mr-3" />
                        Shop All Items
                      </CategoryLink>
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
                alt="Image of a library bookshelf with various books"
                src="https://cdn.libretexts.net/Images/inaki-del-olmo-NIJuEQw0RKg-unsplash-min.jpg"
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
                href="/store/catalog"
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
                  {isLoading && <LoadingSpinner iconOnly />}
                  {!isLoading &&
                    data &&
                    data.map((product) => (
                      <li
                        key={product.id}
                        className="inline-flex w-64 flex-col text-center lg:w-auto border rounded-md p-4 shadow-sm"
                      >
                        <div className="group relative">
                          <div className="flex justify-center">
                            <img
                              alt={`${product.name} product image`}
                              src={product?.images[0]}
                              className="aspect-auto h-64 w-fit rounded-md bg-gray-white object-contain group-hover:opacity-75"
                            />
                          </div>
                          <div className="mt-6">
                            <h3 className="mt-1 text-xl font-semibold text-gray-900">
                              <a href={`/store/product/${product.id}`}>
                                <span className="absolute inset-0" />
                                {product.name}
                              </a>
                            </h3>
                            <TruncatedText
                              text={product.description}
                              maxLines={3}
                              preciseTruncation={true}
                              className="mt-2 text-sm text-gray-500 h-20"
                            />
                            <p className="mt-4 text-lg text-gray-900">
                              {formatPrice(product.prices[0].unit_amount, true)}
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
                href="/store/catalog"
                className="text-sm font-semibold text-primary "
              >
                See everything
                <span aria-hidden="true"> &rarr;</span>
              </a>
            </div>
          </div>
        </section>
      </main>
    </AlternateLayout>
  );
}
