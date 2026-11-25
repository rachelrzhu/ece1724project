"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "../landing.module.css";
import { Icon } from "./icons";
import { Card } from "./material";

const options = [
  { name: "Tomato", href: "/recipes?q=tomato", image: "tomato-eggs.jpg" },
  { name: "Avocado", href: "/recipes?q=avocado", image: "toast.jpg" },
  { name: "Noodles", href: "/recipes?q=noodles", image: "shaanxi-oil-noodles.jpg" },
  { name: "Chicken", href: "/recipes?q=chicken", image: "chicken-gumbo.jpg" },
  { name: "Eggs", href: "/recipes?q=egg", image: "chinese-steamed-egg.jpg" },
  { name: "Lentils", href: "/recipes?q=lentil", image: "red-lentil-dal.jpg" },
  { name: "Salmon", href: "/recipes?q=salmon", image: "salmon-cakes.jpg" },
  { name: "Browse all", href: "/recipes", image: "bowl.jpg" },
];

export function IngredientCarousel() {
  const listRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const updateControls = () => {
      setAtStart(list.scrollLeft <= 1);
      setAtEnd(list.scrollWidth - list.clientWidth - list.scrollLeft <= 1);
    };
    const observer = new ResizeObserver(updateControls);
    observer.observe(list);
    list.addEventListener("scroll", updateControls, { passive: true });
    return () => {
      observer.disconnect();
      list.removeEventListener("scroll", updateControls);
    };
  }, []);

  function scrollOneCard(direction: number) {
    const list = listRef.current;
    if (!list) return;
    const [first, second] = list.children;
    const step = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    list.scrollBy({ left: direction * step });
  }

  return (
    <section aria-labelledby="ingredient-title" className={styles.pantry}>
      <div className={styles.pantryHeader}>
        <h2 id="ingredient-title">Start with an ingredient</h2>
        <div className={styles.scrollControls}>
          <button type="button" aria-label="Previous ingredient" aria-controls="ingredient-options"
            disabled={atStart} onClick={() => scrollOneCard(-1)}><Icon name="back" /></button>
          <button type="button" aria-label="Next ingredient" aria-controls="ingredient-options"
            disabled={atEnd} onClick={() => scrollOneCard(1)}><Icon name="forward" /></button>
        </div>
      </div>
      <ul id="ingredient-options" ref={listRef} className={styles.ingredients}>
        {options.map(({ name, href, image }) => (
          <Card as="li" key={name} className={styles.ingredientCard}>
            <Link href={href} className={styles.ingredient}>
              <div className={styles.ingredientPhoto}>
                <Image src={`/images/${image}`} alt="" fill
                  sizes="(min-width: 72rem) 352px, (min-width: 60rem) 33vw, (min-width: 40rem) 46vw, 84vw" />
              </div>
              <div className={styles.ingredientLabel}>
                <span>{name}</span><Icon name="forward" />
              </div>
            </Link>
          </Card>
        ))}
      </ul>
    </section>
  );
}
