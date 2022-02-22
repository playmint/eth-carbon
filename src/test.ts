import ethCarbon from "./index"

async function main()
{
    await ethCarbon();
}

main().catch((e) =>
{
    console.error(e);
});