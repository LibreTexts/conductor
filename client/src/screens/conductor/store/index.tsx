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
import { Button, Heading, Text } from "@libretexts/davis-react";

const CategoryLink = ({
  href,
  children,
  target,
}: {
  href: string;
  children: React.ReactNode;
  target?: "_blank";
}) => (
  <Button
    as="a"
    href={href}
    target={target}
    variant="outline"
  >
    {children}
  </Button>
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
                    <Heading level={2}>
                      Your favorite OER, on your desk
                    </Heading>
                    <Text className="mt-4" size="xl">
                      Order print copies of textbooks, application access codes,
                      LibreTexts swag, and more.
                    </Text>

                    <div className="my-6 grid grid-cols-1 gap-y-4 sm:grid-cols-3 sm:gap-x-4">
                      <CategoryLink href="/store/catalog?category=books">
                        <IconBook2 className="inline !mr-3" />
                        Books
                      </CategoryLink>
                      <CategoryLink href="/store/catalog?category=access-codes">
                        <IconKey className="inline !mr-3" />
                        Access Codes
                      </CategoryLink>
                      <CategoryLink href="/store/catalog?category=academy">
                        <IconSchool className="inline !mr-3" />
                        Academy Online Courses
                      </CategoryLink>
                      <CategoryLink
                        href="https://swagstore.libretexts.org"
                        target="_blank"
                      >
                        <IconShirt className="inline !mr-3" />
                        Merch
                      </CategoryLink>
                      <CategoryLink href="/store/catalog">
                        <IconShoppingCart className="inline !mr-3" />
                        All Items
                      </CategoryLink>
                    </div>
                    <Text className="mt-4" size="sm">
                      LibreTexts textbooks are{" "}
                      <span className="italic font-semibold">always</span> free
                      to read online. We offer print copies for those who prefer
                      a physical book.
                    </Text>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-48 w-full sm:h-64 lg:absolute lg:right-0 lg:top-0 lg:h-full lg:w-1/2">
              <img
                alt="A library bookshelf with various books"
                src="https://cdn.libretexts.net/Images/inaki-del-olmo-NIJuEQw0RKg-unsplash-min.jpg"
                className="size-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* Trending products */}
        <section aria-labelledby="trending-heading" className="bg-white">
          <div className="py-16 sm:py-24 lg:mx-32 lg:px-8 lg:py-32">
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-0">
              <Heading level={2}
                id="trending-heading"
                className=""
              >
                Trending items
              </Heading>
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
                        className="inline-flex w-64 flex-col text-center lg:w-auto border border-gray-300 rounded-md p-4 shadow-sm"
                      >
                        {/* TODO: Switch to Davis Card component */}
                        <div className="group relative">
                          <div className="flex justify-center">
                            <img
                              alt={`${product.name} product image`}
                              src={product?.images[0]}
                              className="aspect-auto h-64 w-fit rounded-md bg-gray-white object-contain group-hover:opacity-75"
                            />
                          </div>
                          <div className="mt-6">
                            <Heading level={3} className="mt-1">
                              <a href={`/store/product/${product.id}`}>
                                <span className="absolute inset-0" />
                                {product.name}
                              </a>
                            </Heading>
                            <TruncatedText
                              text={product.description}
                              maxLines={3}
                              preciseTruncation={true}
                              className="mt-2 text-sm text-gray-500 h-20"
                            />
                            <Text className="mt-4 text-lg text-gray-900">
                              {formatPrice(product.prices[0].unit_amount, true)}
                            </Text>
                          </div>
                        </div>
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
