interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  imageSrc: string;
}

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  title,
  price,
  imageSrc,
}) => {
  return (
    <div className="group relative border-b border-r border-gray-200 p-4 sm:p-6">
      <img
        alt={`Image of ${title}`}
        src={imageSrc}
        className="aspect-square rounded-lg bg-gray-200 object-cover group-hover:opacity-75"
      />
      <div className="pb-4 pt-10 text-center">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <p className="mt-4 text-base font-medium text-gray-900">${price}</p>
      </div>
    </div>
  );
};

export default ProductCard;
